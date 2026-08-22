import { randomBytes } from 'node:crypto';

import type { HydratedDocument, QueryFilter } from 'mongoose';

import type { AppConfig } from '../../../config/environment.js';
import { ProtectedDocumentStorage } from '../../../infrastructure/files/protected-document-storage.js';
import { renderCertificatePdf } from '../../../infrastructure/pdf/certificate-pdf.js';
import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { isDuplicateKeyError } from '../../../shared/database/mongo-errors.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { EligibilityService } from '../../completion/services/eligibility.service.js';
import { EnrollmentModel } from '../../enrollments/models/enrollment.model.js';
import { SessionScheduleModel } from '../../sessions/models/session-schedule.model.js';
import { TrainingSessionModel } from '../../sessions/models/training-session.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import { UserModel } from '../../users/models/user.model.js';
import type {
  CertificateListInput,
  GenerateCertificateInput,
} from '../dto/certificate.dto.js';
import {
  CertificateModel,
  type Certificate,
} from '../models/certificate.model.js';

function passwordReady(principal: AuthenticatedPrincipal): void {
  if (principal.mustChangePassword) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'The temporary password must be changed before continuing.',
    );
  }
}

function number(issuedAt: Date): string {
  return `CERT-${issuedAt.getUTCFullYear()}-${randomBytes(8)
    .toString('hex')
    .toUpperCase()}`;
}

export class CertificateService {
  readonly #eligibility: EligibilityService;
  readonly #storage: ProtectedDocumentStorage;
  readonly #issuer: AppConfig['center'];

  constructor(
    eligibility: EligibilityService,
    storage: ProtectedDocumentStorage,
    issuer: AppConfig['center'],
  ) {
    this.#eligibility = eligibility;
    this.#storage = storage;
    this.#issuer = issuer;
  }

  async list(principal: AuthenticatedPrincipal, input: CertificateListInput) {
    passwordReady(principal);
    const filter = await this.#readerFilter(principal);
    const [certificates, total] = await Promise.all([
      CertificateModel.find(filter)
        .sort({ issuedAt: -1, _id: -1 })
        .skip((input.page - 1) * input.pageSize)
        .limit(input.pageSize)
        .exec(),
      CertificateModel.countDocuments(filter),
    ]);
    return {
      items: certificates.map((certificate) => this.#view(certificate)),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async get(principal: AuthenticatedPrincipal, certificateId: string) {
    return this.#view(
      await this.#authorizedCertificate(principal, certificateId),
    );
  }

  async generate(
    principal: AuthenticatedPrincipal,
    input: GenerateCertificateInput,
  ) {
    passwordReady(principal);
    const enrollment = await this.#authorizedEnrollment(
      principal,
      input.enrollmentId,
    );
    let certificate = await CertificateModel.findOne({
      enrollmentId: enrollment._id,
    }).exec();
    if (certificate === null) {
      const eligibility = await this.#eligibility.evaluate(input.enrollmentId);
      if (
        !eligibility.eligible ||
        eligibility.completion.completedAt === undefined
      ) {
        throw new AppError(
          409,
          'CERTIFICATE_NOT_ELIGIBLE',
          eligibility.failures.includes('TRAINING_INCOMPLETE')
            ? 'The Training completion requirements are not satisfied.'
            : 'The certifying Evaluation has not been passed.',
        );
      }
      const learner = await UserModel.findById(enrollment.learnerId).exec();
      if (
        learner === null ||
        learner.profile.firstName === undefined ||
        learner.profile.lastName === undefined
      ) {
        throw new AppError(
          409,
          'LEARNER_PROFILE_INCOMPLETE',
          'The Learner first and last name are required for a Certificate.',
        );
      }
      const issuedAt = new Date();
      const session =
        enrollment.sessionId === undefined || enrollment.sessionId === null
          ? null
          : await TrainingSessionModel.findById(enrollment.sessionId).exec();
      const schedules =
        session === null
          ? []
          : await SessionScheduleModel.find({ sessionId: session._id })
              .sort({ startAt: 1, _id: 1 })
              .exec();
      const firstSchedule = schedules[0];
      const lastSchedule = schedules.at(-1);
      const value = {
        enrollmentId: enrollment._id,
        learnerId: enrollment.learnerId,
        trainingId: enrollment.trainingId,
        ...(enrollment.sessionId === undefined || enrollment.sessionId === null
          ? {}
          : { sessionId: enrollment.sessionId }),
        number: number(issuedAt),
        issuedAt,
        learner: {
          email: learner.email,
          firstName: learner.profile.firstName,
          lastName: learner.profile.lastName,
        },
        training: {
          title: eligibility.training.title,
          type: eligibility.training.type,
          durationMinutes: eligibility.training.durationMinutes,
          enrolledAt: enrollment.createdAt,
          ...(session === null ? {} : { sessionTitle: session.title }),
          ...(firstSchedule === undefined
            ? {}
            : { startsAt: firstSchedule.startAt }),
          ...(lastSchedule === undefined ? {} : { endsAt: lastSchedule.endAt }),
        },
        eligibility: {
          completionPercentage: eligibility.completion.percentage,
          completedAt: eligibility.completion.completedAt,
          ...(eligibility.certifyingEvaluation === undefined
            ? {}
            : {
                certifyingEvaluationId:
                  eligibility.training.certifyingEvaluationId,
                passedAttemptId:
                  eligibility.certifyingEvaluation.passedAttemptId,
                passedAt: eligibility.certifyingEvaluation.passedAt,
              }),
        },
        issuer: {
          name: this.#issuer.name,
          address: this.#issuer.address,
          email: this.#issuer.email,
          ...(this.#issuer.phone === undefined
            ? {}
            : { phone: this.#issuer.phone }),
          ...(this.#issuer.registrationId === undefined
            ? {}
            : { registrationId: this.#issuer.registrationId }),
          ...(this.#issuer.logoPath === undefined
            ? {}
            : { logoPath: this.#issuer.logoPath }),
        },
      };
      for (let attempt = 0; attempt < 4 && certificate === null; attempt += 1) {
        try {
          certificate = await CertificateModel.create({
            ...value,
            number: attempt === 0 ? value.number : number(issuedAt),
          });
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
          certificate = await CertificateModel.findOne({
            enrollmentId: enrollment._id,
          }).exec();
          if (certificate === null && attempt === 3) throw error;
        }
      }
    }
    if (certificate === null) {
      throw new Error('Certificate idempotence could not be resolved.');
    }
    certificate = await this.#ensurePdf(certificate);
    return this.#view(certificate);
  }

  async downloadablePdf(
    principal: AuthenticatedPrincipal,
    certificateId: string,
  ): Promise<{ absolutePath: string; filename: string }> {
    const certificate = await this.#ensurePdf(
      await this.#authorizedCertificate(principal, certificateId),
    );
    if (certificate.pdf === undefined) {
      throw new Error('Certificate PDF metadata was not persisted.');
    }
    return {
      absolutePath: this.#storage.resolve(certificate.pdf.relativePath),
      filename: `${certificate.number}.pdf`,
    };
  }

  async #ensurePdf(certificate: HydratedDocument<Certificate>) {
    if (
      certificate.pdf !== undefined &&
      (await this.#storage.isReadable(certificate.pdf.relativePath))
    ) {
      return certificate;
    }
    const stored = await this.#storage.writeCertificate(
      String(certificate._id),
      await renderCertificatePdf(certificate),
    );
    return (
      (await CertificateModel.findByIdAndUpdate(
        certificate._id,
        { $set: { pdf: stored } },
        { returnDocument: 'after' },
      ).exec()) ?? certificate
    );
  }

  async #authorizedEnrollment(
    principal: AuthenticatedPrincipal,
    enrollmentId: string,
  ) {
    const enrollment = await EnrollmentModel.findById(enrollmentId).exec();
    if (enrollment === null) throw this.#notFound();
    if (principal.role === 'ADMIN') return enrollment;
    if (
      principal.role === 'LEARNER' &&
      String(enrollment.learnerId) === principal.userId
    ) {
      return enrollment;
    }
    if (principal.role === 'TRAINER') {
      const [owned, assigned] = await Promise.all([
        TrainingModel.exists({
          _id: enrollment.trainingId,
          ownerTrainerId: principal.userId,
        }),
        enrollment.sessionId === undefined || enrollment.sessionId === null
          ? null
          : TrainingSessionModel.exists({
              _id: enrollment.sessionId,
              assignedTrainerIds: principal.userId,
            }),
      ]);
      if (owned !== null || assigned !== null) return enrollment;
    }
    throw this.#notFound();
  }

  async #authorizedCertificate(
    principal: AuthenticatedPrincipal,
    certificateId: string,
  ) {
    passwordReady(principal);
    const certificate = await CertificateModel.findById(certificateId).exec();
    if (certificate === null) throw this.#notFound();
    await this.#authorizedEnrollment(
      principal,
      String(certificate.enrollmentId),
    );
    return certificate;
  }

  async #readerFilter(
    principal: AuthenticatedPrincipal,
  ): Promise<QueryFilter<Certificate>> {
    if (principal.role === 'ADMIN') return {};
    if (principal.role === 'LEARNER') return { learnerId: principal.userId };
    const [trainingIds, sessionIds] = await Promise.all([
      TrainingModel.find({ ownerTrainerId: principal.userId }).distinct('_id'),
      TrainingSessionModel.find({
        assignedTrainerIds: principal.userId,
      }).distinct('_id'),
    ]);
    return {
      $or: [
        { trainingId: { $in: trainingIds } },
        { sessionId: { $in: sessionIds } },
      ],
    };
  }

  #view(certificate: HydratedDocument<Certificate>) {
    return {
      id: String(certificate._id),
      enrollmentId: String(certificate.enrollmentId),
      learnerId: String(certificate.learnerId),
      trainingId: String(certificate.trainingId),
      ...(certificate.sessionId === undefined
        ? {}
        : { sessionId: String(certificate.sessionId) }),
      number: certificate.number,
      issuedAt: certificate.issuedAt.toISOString(),
      learner: certificate.learner,
      training: certificate.training,
      eligibility: certificate.eligibility,
      issuer: {
        name: certificate.issuer.name,
        address: certificate.issuer.address,
        email: certificate.issuer.email,
        ...(certificate.issuer.phone === undefined
          ? {}
          : { phone: certificate.issuer.phone }),
        ...(certificate.issuer.registrationId === undefined
          ? {}
          : { registrationId: certificate.issuer.registrationId }),
      },
      pdfDownloadUrl: `/api/certificates/${String(certificate._id)}/pdf`,
      createdAt: certificate.createdAt.toISOString(),
    };
  }

  #notFound() {
    return new AppError(
      404,
      'CERTIFICATE_NOT_FOUND',
      'The Certificate or eligible Enrollment does not exist.',
    );
  }
}
