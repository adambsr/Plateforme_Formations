import { pathToFileURL } from 'node:url';
import mongoose, { Types } from 'mongoose';
import { AttendanceModel } from '../modules/attendance/models/attendance.model.js';
import { CertificateModel } from '../modules/certificates/models/certificate.model.js';
import { LessonModel } from '../modules/content/models/lesson.model.js';
import { TrainingModuleModel } from '../modules/content/models/training-module.model.js';
import { TrainingResourceModel } from '../modules/content/models/training-resource.model.js';
import { TrainerCostModel } from '../modules/costs/models/trainer-cost.model.js';
import { TrainingCostModel } from '../modules/costs/models/training-cost.model.js';
import { EnrollmentModel } from '../modules/enrollments/models/enrollment.model.js';
import { EvaluationAnswerModel } from '../modules/evaluations/models/evaluation-answer.model.js';
import { EvaluationAttemptModel } from '../modules/evaluations/models/evaluation-attempt.model.js';
import { EvaluationModel } from '../modules/evaluations/models/evaluation.model.js';
import { EvaluationQuestionModel } from '../modules/evaluations/models/evaluation-question.model.js';
import { FeedbackModel } from '../modules/feedback/models/feedback.model.js';
import { InvoiceItemModel } from '../modules/invoices/models/invoice-item.model.js';
import { InvoiceModel } from '../modules/invoices/models/invoice.model.js';
import { PaymentModel } from '../modules/payments/models/payment.model.js';
import { LessonProgressModel } from '../modules/progress/models/lesson-progress.model.js';
import { SessionScheduleModel } from '../modules/sessions/models/session-schedule.model.js';
import { TrainingSessionModel } from '../modules/sessions/models/training-session.model.js';
import { TrainingCategoryModel } from '../modules/trainings/models/training-category.model.js';
import { TrainingModel } from '../modules/trainings/models/training.model.js';
import { UserModel } from '../modules/users/models/user.model.js';
import { hashPassword } from '../shared/auth/password.js';

export const DEVELOPMENT_SEED_CONFIRMATION = 'replace-local-development-data';
export const DEVELOPMENT_DEMO_PASSWORD = 'Demo2026!Formation';

export function assertDevelopmentSeedTarget(environment: NodeJS.ProcessEnv) {
  if (environment.NODE_ENV !== 'development') {
    throw new Error('Development seed requires NODE_ENV=development.');
  }
  if (environment.CONFIRM_DEVELOPMENT_SEED !== DEVELOPMENT_SEED_CONFIRMATION) {
    throw new Error(
      `Set CONFIRM_DEVELOPMENT_SEED=${DEVELOPMENT_SEED_CONFIRMATION} to confirm the local reset.`,
    );
  }
  const rawUri = environment.MONGODB_URI;
  if (!rawUri) throw new Error('MONGODB_URI is required.');
  const uri = new URL(rawUri);
  if (!['localhost', '127.0.0.1', 'mongodb'].includes(uri.hostname)) {
    throw new Error(
      'Development seed only accepts a local or Compose MongoDB host.',
    );
  }
  if (uri.pathname.replace(/^\//, '') !== 'plateforme_formations') {
    throw new Error(
      'Development seed only accepts the plateforme_formations database.',
    );
  }
  return rawUri;
}

const objectId = (group: number, index: number) =>
  new Types.ObjectId(
    `${group.toString(16).padStart(8, '0')}${index.toString(16).padStart(16, '0')}`,
  );
const date = (monthOffset: number, day = 12) => {
  const value = new Date();
  value.setUTCMonth(value.getUTCMonth() + monthOffset, day);
  value.setUTCHours(9, 0, 0, 0);
  return value;
};
const models = [
  EvaluationAnswerModel,
  EvaluationAttemptModel,
  EvaluationQuestionModel,
  CertificateModel,
  FeedbackModel,
  AttendanceModel,
  LessonProgressModel,
  InvoiceItemModel,
  InvoiceModel,
  EnrollmentModel,
  PaymentModel,
  SessionScheduleModel,
  TrainingSessionModel,
  EvaluationModel,
  TrainingResourceModel,
  LessonModel,
  TrainingModuleModel,
  TrainingCostModel,
  TrainerCostModel,
  TrainingModel,
  TrainingCategoryModel,
  UserModel,
] as const;

export async function seedDevelopmentData(environment = process.env) {
  const databaseUri = assertDevelopmentSeedTarget(environment);
  await mongoose.connect(databaseUri);
  try {
    for (const model of models) await model.collection.deleteMany({});
    const passwordHash = await hashPassword(DEVELOPMENT_DEMO_PASSWORD);
    const trainerNames = [
      ['Sami', 'Trabelsi'],
      ['Inès', 'Ben Amor'],
      ['Karim', 'Mansour'],
      ['Leïla', 'Gharbi'],
    ] as const;
    const learnerNames = [
      ['Ahmed', 'Adam'],
      ['Meriem', 'Jaziri'],
      ['Youssef', 'Ben Salah'],
      ['Amira', 'Khelifi'],
      ['Nour', 'Ayari'],
      ['Mehdi', 'Bouazizi'],
      ['Rania', 'Mejri'],
      ['Omar', 'Hamdi'],
      ['Salma', 'Dridi'],
      ['Aziz', 'Chaabane'],
      ['Lina', 'Saidi'],
      ['Walid', 'Triki'],
      ['Emna', 'Kammoun'],
      ['Fares', 'Abid'],
      ['Sarra', 'Mabrouk'],
      ['Rayen', 'Nasri'],
      ['Yasmine', 'Cherif'],
      ['Bilel', 'Guesmi'],
      ['Aya', 'Haddad'],
      ['Skander', 'Tlili'],
      ['Hela', 'Zouari'],
      ['Malek', 'Baccar'],
      ['Fairouz', 'Raouin'],
    ] as const;
    const trainerIds = trainerNames.map((_, index) => objectId(1, index + 2));
    const learnerIds = learnerNames.map((_, index) => objectId(1, index + 10));
    await UserModel.insertMany([
      {
        _id: objectId(1, 1),
        email: 'admin.demo@formation.test',
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        mustChangePassword: false,
        passwordChangedAt: date(-6),
        profile: { firstName: 'Admin', lastName: 'Démo' },
      },
      ...trainerNames.map(([firstName, lastName], index) => ({
        _id: trainerIds[index],
        email: `${firstName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()}.${lastName.toLowerCase().replace(' ', '')}@formation.test`,
        passwordHash,
        role: 'TRAINER' as const,
        isActive: true,
        mustChangePassword: false,
        passwordChangedAt: date(-6),
        profile: { firstName, lastName },
      })),
      ...learnerNames.map(([firstName, lastName], index) => ({
        _id: learnerIds[index],
        email:
          firstName === 'Fairouz' && lastName === 'Raouin'
            ? 'fairouz.raouin@gmail.com'
            : `apprenant${String(index + 1).padStart(2, '0')}@formation.test`,
        passwordHash,
        role: 'LEARNER' as const,
        isActive: true,
        mustChangePassword: false,
        passwordChangedAt: date(-6),
        profile: { firstName, lastName },
      })),
    ]);
    const categoryData = [
      [
        'Développement web',
        'Compétences frontend, backend et qualité logicielle.',
      ],
      [
        'Data & IA',
        'Analyse de données et intelligence artificielle appliquée.',
      ],
      ['Management', 'Leadership, gestion de projet et communication.'],
      ['Design numérique', 'Conception d’interfaces accessibles et utiles.'],
      ['Bureautique', 'Productivité et outils professionnels du quotidien.'],
    ] as const;
    const categoryIds = categoryData.map((_, index) => objectId(2, index + 1));
    await TrainingCategoryModel.insertMany(
      categoryData.map(([name, description], index) => ({
        _id: categoryIds[index],
        name,
        normalizedName: name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase(),
        description,
        isArchived: false,
      })),
    );
    const trainingData = [
      [
        'React moderne et TypeScript',
        0,
        'Intermédiaire',
        'SELF_PACED_ONLINE',
        18900,
      ],
      ['Node.js et API REST', 0, 'Intermédiaire', 'SELF_PACED_ONLINE', 21900],
      ['JavaScript : fondamentaux', 0, 'Débutant', 'SELF_PACED_ONLINE', 12900],
      [
        'Tests automatisés pour le Web',
        0,
        'Intermédiaire',
        'SELF_PACED_ONLINE',
        16900,
      ],
      [
        'Analyse de données avec Python',
        1,
        'Débutant',
        'SELF_PACED_ONLINE',
        19900,
      ],
      [
        'Introduction à l’IA générative',
        1,
        'Débutant',
        'SELF_PACED_ONLINE',
        17900,
      ],
      ['SQL pour l’analyse', 1, 'Intermédiaire', 'SELF_PACED_ONLINE', 15900],
      ['Gestion de projet agile', 2, 'Débutant', 'SELF_PACED_ONLINE', 14900],
      [
        'Communication professionnelle',
        2,
        'Tous niveaux',
        'SELF_PACED_ONLINE',
        11900,
      ],
      ['Excel avancé', 4, 'Avancé', 'SELF_PACED_ONLINE', 15900],
      ['Leadership de proximité', 2, 'Intermédiaire', 'IN_PERSON', 34900],
      ['UX Design : atelier pratique', 3, 'Débutant', 'IN_PERSON', 29900],
      ['Accessibilité numérique', 3, 'Intermédiaire', 'IN_PERSON', 27900],
      ['Prise de parole en public', 2, 'Tous niveaux', 'IN_PERSON', 24900],
      ['Power BI : tableaux de bord', 1, 'Intermédiaire', 'IN_PERSON', 31900],
      ['Cybersécurité au quotidien', 0, 'Tous niveaux', 'IN_PERSON', 22900],
    ] as const;
    const trainingIds = trainingData.map((_, index) => objectId(3, index + 1));
    const trainingThumbnails = [
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1543286386-713bdd548da4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1200&q=80',
    ] as const;
    await TrainingModel.insertMany(
      trainingData.map(([title, category, level, type, priceMinor], index) => ({
        _id: trainingIds[index],
        title,
        description: `Un parcours concret pour maîtriser ${title.toLowerCase()} et appliquer les acquis en contexte professionnel.`,
        categoryId: categoryIds[category],
        level,
        durationMinutes: type === 'IN_PERSON' ? 840 : 600 + index * 30,
        objectives: [
          `Appliquer les principes essentiels de ${title}`,
          'Réaliser une mise en pratique professionnelle',
        ],
        prerequisites: ['Aucun prérequis technique obligatoire'],
        type,
        priceMinor,
        currency: 'EUR' as const,
        thumbnailExternalUrl: trainingThumbnails[index],
        ownerTrainerId: trainerIds[index % trainerIds.length],
        status: 'PUBLISHED' as const,
        ...(type === 'IN_PERSON' ? { minimumAttendancePercent: 75 } : {}),
      })),
    );
    const moduleIds = trainingIds.flatMap((_, trainingIndex) =>
      [0, 1].map((moduleIndex) =>
        objectId(4, trainingIndex * 2 + moduleIndex + 1),
      ),
    );
    await TrainingModuleModel.insertMany(
      trainingIds.flatMap((trainingId, trainingIndex) =>
        [0, 1].map((moduleIndex) => ({
          _id: moduleIds[trainingIndex * 2 + moduleIndex],
          trainingId,
          title: moduleIndex === 0 ? 'Fondamentaux' : 'Mise en pratique',
          description:
            moduleIndex === 0
              ? 'Notions, vocabulaire et méthodes essentielles.'
              : 'Cas concret guidé et bonnes pratiques.',
          order: moduleIndex + 1,
          isArchived: false,
        })),
      ),
    );
    const lessonIds = trainingIds.flatMap((_, trainingIndex) =>
      [0, 1, 2, 3].map((lessonIndex) =>
        objectId(5, trainingIndex * 4 + lessonIndex + 1),
      ),
    );
    await LessonModel.insertMany(
      trainingIds.flatMap((trainingId, trainingIndex) =>
        [0, 1, 2, 3].map((lessonIndex) => ({
          _id: lessonIds[trainingIndex * 4 + lessonIndex],
          trainingId,
          moduleId: moduleIds[trainingIndex * 2 + Math.floor(lessonIndex / 2)],
          title: [
            'Comprendre les enjeux',
            'Découvrir la méthode',
            'Réaliser le cas pratique',
            'Consolider les acquis',
          ][lessonIndex],
          description:
            'Une étape concise orientée vers une application professionnelle.',
          textContent: `Cette leçon de « ${trainingData[trainingIndex]![0]} » présente des notions vérifiables, un exemple concret et des points de contrôle.`,
          instructions:
            'Lisez le contenu, consultez la ressource puis réalisez l’exercice proposé.',
          order: (lessonIndex % 2) + 1,
          isArchived: false,
        })),
      ),
    );
    await TrainingResourceModel.insertMany(
      lessonIds.map((lessonId, index) => ({
        _id: objectId(6, index + 1),
        trainingId: trainingIds[Math.floor(index / 4)],
        lessonId,
        title: 'Guide complémentaire',
        description:
          'Ressource externe de référence pour approfondir la leçon.',
        order: 1,
        type: 'EXTERNAL_URL' as const,
        isVisibleToLearners: true,
        externalUrl: 'https://developer.mozilla.org/fr/docs/Learn',
        isArchived: false,
      })),
    );
    const inPersonTrainingIds = trainingIds.slice(10);
    const sessionTitle = (trainingIndex: number, occurrence: number) =>
      `${trainingData[trainingIndex]![0]} — ${
        occurrence === 0
          ? 'promotion printemps terminée'
          : 'promotion automne à venir'
      }`;
    const sessionIds = inPersonTrainingIds.flatMap((_, index) => [
      objectId(7, index * 2 + 1),
      objectId(7, index * 2 + 2),
    ]);
    await TrainingSessionModel.insertMany(
      inPersonTrainingIds.flatMap((trainingId, index) =>
        [0, 1].map((occurrence) => ({
          _id: sessionIds[index * 2 + occurrence],
          trainingId,
          title: sessionTitle(10 + index, occurrence),
          identifier: `DEV-${index + 1}-${occurrence + 1}`,
          capacity: 14,
          enrolledCount: occurrence === 0 ? 3 : 2,
          assignedTrainerIds: [trainerIds[(index + 2) % trainerIds.length]],
          location: 'Centre de formation Tunis',
          address: 'Route Manzel Chaker km 2.5 en face Magasin Général (MG) , Sfax, Tunisia',
          room: `Salle ${index + 1}`,
          additionalInformation: 'Accueil quinze minutes avant le début.',
          status:
            occurrence === 0
              ? ('COMPLETED' as const)
              : index === 0
                ? ('IN_PROGRESS' as const)
                : ('PLANNED' as const),
        })),
      ),
    );
    const scheduleIds = sessionIds.flatMap((_, index) => [
      objectId(8, index * 2 + 1),
      objectId(8, index * 2 + 2),
    ]);
    await SessionScheduleModel.insertMany(
      sessionIds.flatMap((sessionId, sessionIndex) => {
        const trainingIndex = 10 + Math.floor(sessionIndex / 2);
        const completed = sessionIndex % 2 === 0;
        const base = completed
          ? date(-2, 8 + sessionIndex)
          : date(1, 8 + sessionIndex);
        return [0, 1].map((slot) => {
          const startAt = new Date(base);
          startAt.setUTCDate(startAt.getUTCDate() + slot);
          const endAt = new Date(startAt);
          endAt.setUTCHours(16, 0, 0, 0);
          return {
            _id: scheduleIds[sessionIndex * 2 + slot],
            sessionId,
            trainingId: trainingIds[trainingIndex],
            startAt,
            endAt,
            moduleId: moduleIds[trainingIndex * 2 + slot],
            lessonId: lessonIds[trainingIndex * 4 + slot * 2],
            trainerIds: [trainerIds[(trainingIndex + 2) % trainerIds.length]],
            location: 'Centre de formation Tunis',
            address: 'Route Manzel Chaker km 2.5 en face Magasin Général (MG) , Sfax, Tunisia',
            room: `Salle ${Math.floor(sessionIndex / 2) + 1}`,
            normalizedLocationRoom: `centre de formation tunis|salle ${Math.floor(sessionIndex / 2) + 1}`,
          };
        });
      }),
    );
    const onlineTrainingIndexes = trainingData.flatMap((training, index) =>
      training[3] === 'SELF_PACED_ONLINE' ? [index] : [],
    );
    const evaluationIds = onlineTrainingIndexes.map((_, index) =>
      objectId(9, index + 1),
    );
    const evaluationIdByTrainingIndex = new Map(
      onlineTrainingIndexes.map((trainingIndex, index) => [
        trainingIndex,
        evaluationIds[index]!,
      ]),
    );
    await EvaluationModel.insertMany(
      onlineTrainingIndexes.map((trainingIndex, index) => ({
        _id: evaluationIds[index],
        trainingId: trainingIds[trainingIndex],
        ownerTrainerId: trainerIds[trainingIndex % trainerIds.length],
        title: `Évaluation finale — ${trainingData[trainingIndex]![0]}`,
        instructions: 'Sélectionnez la meilleure réponse pour chaque question.',
        status: 'PUBLISHED' as const,
        passPercentage: 70,
        maxAttempts: 3,
        durationMinutes: 20,
        publishedAt: date(-5),
      })),
    );
    await TrainingModel.bulkWrite(
      onlineTrainingIndexes.map((trainingIndex) => ({
        updateOne: {
          filter: { _id: trainingIds[trainingIndex]! },
          update: {
            $set: {
              certifyingEvaluationId:
                evaluationIds[onlineTrainingIndexes.indexOf(trainingIndex)]!,
            },
          },
        },
      })),
    );
    const questionIds = evaluationIds.flatMap((_, index) =>
      [0, 1, 2].map((question) => objectId(10, index * 3 + question + 1)),
    );
    await EvaluationQuestionModel.insertMany(
      evaluationIds.flatMap((evaluationId, index) =>
        [0, 1, 2].map((question) => ({
          _id: questionIds[index * 3 + question],
          evaluationId,
          trainingId: trainingIds[onlineTrainingIndexes[index]!]!,
          order: question + 1,
          points: 1,
          prompt: [
            `Quel est le rôle principal de la structure étudiée dans ${trainingData[onlineTrainingIndexes[index]!]![0]} ?`,
            `Quelle pratique améliore directement la qualité d'un projet ${trainingData[onlineTrainingIndexes[index]!]![0]} ?`,
            `Quel contrôle permet de valider les acquis en ${trainingData[onlineTrainingIndexes[index]!]![0]} ?`,
          ][question],
          explanation:
            'La réponse attendue correspond aux notions et pratiques présentées dans le parcours.',
          type: 'SINGLE_CHOICE' as const,
          options: [
            {
              id: 'a',
              text: [
                'Organiser les données et les responsabilités',
                'Tester le comportement attendu',
                'Comparer le résultat aux critères définis',
              ][question]!,
            },
            {
              id: 'b',
              text: [
                'Supprimer les contrôles',
                'Modifier le code sans vérification',
                'Ignorer les critères de réussite',
              ][question]!,
            },
            {
              id: 'c',
              text: [
                'Travailler sans objectif',
                'Éviter les cas limites',
                'Reporter toute validation',
              ][question]!,
            },
          ],
          correctOptionIds: ['a'],
        })),
      ),
    );
    const paidPurchases = learnerIds.flatMap((learnerId, learnerIndex) => {
      const isFairouz = learnerNames[learnerIndex]?.[0] === 'Fairouz';
      const onlineIndex = learnerIndex % 10;
      const sessionIndex = learnerIndex % sessionIds.length;
      const inPersonIndex = 10 + Math.floor(sessionIndex / 2);
      return [
        {
          learnerId,
          learnerIndex,
          trainingIndex: isFairouz ? 3 : onlineIndex,
          trainingId: trainingIds[isFairouz ? 3 : onlineIndex],
          sessionId: undefined,
          purchaseType: 'SELF_PACED_ONLINE' as const,
        },
        {
          learnerId,
          learnerIndex,
          trainingIndex: isFairouz ? 15 : inPersonIndex,
          trainingId: trainingIds[isFairouz ? 15 : inPersonIndex],
          sessionId: sessionIds[isFairouz ? 11 : sessionIndex],
          purchaseType: 'IN_PERSON' as const,
        },
      ];
    });
    const paymentIds = paidPurchases.map((_, index) => objectId(11, index + 1));
    const enrollmentIds = paidPurchases.map((_, index) =>
      objectId(12, index + 1),
    );
    await PaymentModel.insertMany([
      ...paidPurchases.map((purchase, index) => ({
        _id: paymentIds[index],
        learnerId: purchase.learnerId,
        trainingId: purchase.trainingId,
        ...(purchase.sessionId ? { sessionId: purchase.sessionId } : {}),
        purchaseType: purchase.purchaseType,
        status: 'PAID' as const,
        amountMinor: trainingData[purchase.trainingIndex]![4],
        currency: 'EUR' as const,
        trainingTitle: trainingData[purchase.trainingIndex]![0],
        ...(purchase.sessionId
          ? {
              sessionTitle: sessionTitle(
                purchase.trainingIndex,
                sessionIds.indexOf(purchase.sessionId) % 2,
              ),
            }
          : {}),
        stripeCheckoutSessionId: `cs_test_seed_paid_${index + 1}`,
        stripePaymentIntentId: `pi_test_seed_${index + 1}`,
        lastStripeEventId: `evt_test_seed_${index + 1}`,
        paidAt: date(-5 + (index % 6), 4 + (index % 20)),
      })),
      ...Array.from({ length: 12 }, (_, index) => {
        const trainingIndex = index % trainingIds.length;
        const status = (['PENDING', 'FAILED', 'CANCELLED'] as const)[
          index % 3
        ]!;
        return {
          _id: objectId(11, 100 + index),
          learnerId: learnerIds[index],
          trainingId: trainingIds[trainingIndex],
          purchaseType: trainingData[trainingIndex]![3],
          status,
          amountMinor: trainingData[trainingIndex]![4],
          currency: 'EUR' as const,
          trainingTitle: trainingData[trainingIndex]![0],
          stripeCheckoutSessionId: `cs_test_seed_${status.toLowerCase()}_${index + 1}`,
          ...(status === 'FAILED'
            ? {
                failureCode: 'card_declined',
                failureMessage: 'Paiement de démonstration refusé.',
              }
            : {}),
        };
      }),
    ]);
    await EnrollmentModel.insertMany(
      paidPurchases.map((purchase, index) => ({
        _id: enrollmentIds[index],
        learnerId: purchase.learnerId,
        trainingId: purchase.trainingId,
        sessionId: purchase.sessionId ?? null,
        paymentId: paymentIds[index],
        createdAt: date(-5 + (index % 6), 4 + (index % 20)),
      })),
    );
    const sessionEnrollmentCounts = new Map<string, number>();
    for (const purchase of paidPurchases) {
      if (purchase.sessionId) {
        const key = purchase.sessionId.toHexString();
        sessionEnrollmentCounts.set(
          key,
          (sessionEnrollmentCounts.get(key) ?? 0) + 1,
        );
      }
    }
    await TrainingSessionModel.bulkWrite(
      [...sessionEnrollmentCounts].map(([id, enrolledCount]) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(id) },
          update: { $set: { enrolledCount } },
        },
      })),
    );
    const invoiceIds = paidPurchases.map((_, index) => objectId(13, index + 1));
    const issuer = {
      name: 'High Skills Academy — Démonstration',
      address: 'Route Manzel Chaker km 2.5 en face Magasin Général (MG) , Sfax, Tunisia',
      email: 'highskills.ac@gmail.com',
      phone: '+216 70 000 000',
      registrationId: 'DEV-DEMO-001',
    };
    await InvoiceModel.insertMany(
      paidPurchases.map((purchase, index) => {
        const [firstName, lastName] = learnerNames[purchase.learnerIndex]!;
        const amountMinor = trainingData[purchase.trainingIndex]![4];
        return {
          _id: invoiceIds[index],
          paymentId: paymentIds[index],
          enrollmentId: enrollmentIds[index],
          learnerId: purchase.learnerId,
          trainingId: purchase.trainingId,
          ...(purchase.sessionId ? { sessionId: purchase.sessionId } : {}),
          number: `DEV-FACT-${String(index + 1).padStart(4, '0')}`,
          issuedAt: date(-5 + (index % 6), 4 + (index % 20)),
          learner: {
            email:
              learnerNames[purchase.learnerIndex]?.[0] === 'Fairouz'
                ? 'fairouz.raouin@gmail.com'
                : `apprenant${String(purchase.learnerIndex + 1).padStart(2, '0')}@formation.test`,
            firstName,
            lastName,
          },
          issuer,
          purchaseDescription: trainingData[purchase.trainingIndex]![0],
          subtotalMinor: amountMinor,
          totalMinor: amountMinor,
          currency: 'EUR' as const,
        };
      }),
    );
    await InvoiceItemModel.insertMany(
      paidPurchases.map((purchase, index) => {
        const amountMinor = trainingData[purchase.trainingIndex]![4];
        return {
          _id: objectId(14, index + 1),
          invoiceId: invoiceIds[index],
          description: trainingData[purchase.trainingIndex]![0],
          quantity: 1 as const,
          unitAmountMinor: amountMinor,
          totalMinor: amountMinor,
          currency: 'EUR' as const,
        };
      }),
    );
    const progressRecords = paidPurchases.flatMap((purchase, purchaseIndex) => {
      if (purchase.purchaseType !== 'SELF_PACED_ONLINE') return [];
      const completedCount =
        purchase.learnerIndex % 3 === 0 ? 4 : 1 + (purchase.learnerIndex % 3);
      return [0, 1, 2, 3].map((lessonIndex) => {
        const completed = lessonIndex < completedCount;
        return {
          _id: objectId(15, purchaseIndex * 4 + lessonIndex + 1),
          enrollmentId: enrollmentIds[purchaseIndex],
          learnerId: purchase.learnerId,
          trainingId: purchase.trainingId,
          lessonId: lessonIds[purchase.trainingIndex * 4 + lessonIndex],
          completed,
          completedAt: completed ? date(-1, 5 + lessonIndex) : null,
        };
      });
    });
    await LessonProgressModel.insertMany(progressRecords);
    const attendanceRecords = paidPurchases.flatMap(
      (purchase, purchaseIndex) => {
        if (!purchase.sessionId) return [];
        const sessionIndex = sessionIds.findIndex((id) =>
          id.equals(purchase.sessionId),
        );
        if (sessionIndex % 2 !== 0) return [];
        return [0, 1].map((slot) => ({
          _id: objectId(16, purchaseIndex * 2 + slot + 1),
          enrollmentId: enrollmentIds[purchaseIndex],
          learnerId: purchase.learnerId,
          trainingId: purchase.trainingId,
          sessionId: purchase.sessionId,
          scheduleId: scheduleIds[sessionIndex * 2 + slot],
          status:
            purchase.learnerIndex % 7 === 0 && slot === 1
              ? ('ABSENT' as const)
              : ('PRESENT' as const),
          recordedById:
            trainerIds[(purchase.trainingIndex + 2) % trainerIds.length],
        }));
      },
    );
    await AttendanceModel.insertMany(attendanceRecords);
    const outcomePurchases = paidPurchases.filter((purchase) => {
      if (purchase.purchaseType === 'SELF_PACED_ONLINE')
        return purchase.learnerIndex % 3 === 0;
      const sessionIndex = sessionIds.findIndex((id) =>
        id.equals(purchase.sessionId),
      );
      return sessionIndex % 2 === 0 && purchase.learnerIndex % 7 !== 0;
    });
    const evaluatedOutcomePurchases = outcomePurchases.filter(
      (purchase) => purchase.purchaseType === 'SELF_PACED_ONLINE',
    );
    const outcomeIndexes = outcomePurchases.map((purchase) =>
      paidPurchases.indexOf(purchase),
    );
    const evaluatedOutcomeIndexes = evaluatedOutcomePurchases.map((purchase) =>
      paidPurchases.indexOf(purchase),
    );
    const attemptIds = evaluatedOutcomePurchases.map((_, index) =>
      objectId(17, index + 1),
    );
    await EvaluationAttemptModel.insertMany(
      evaluatedOutcomePurchases.map((purchase, index) => {
        const purchaseIndex = evaluatedOutcomeIndexes[index]!;
        return {
          _id: attemptIds[index],
          evaluationId: evaluationIdByTrainingIndex.get(
            purchase.trainingIndex,
          )!,
          trainingId: purchase.trainingId,
          enrollmentId: enrollmentIds[purchaseIndex],
          learnerId: purchase.learnerId,
          attemptNumber: 1,
          status: 'PASSED' as const,
          startedAt: date(-1, 18),
          submittedAt: date(-1, 18),
          scorePoints: 3,
          totalPoints: 3,
          scorePercentage: 100,
          settings: { passPercentage: 70, maxAttempts: 3, durationMinutes: 20 },
        };
      }),
    );
    await EvaluationAnswerModel.insertMany(
      evaluatedOutcomePurchases.flatMap((purchase, outcomeIndex) =>
        [0, 1, 2].map((questionIndex) => ({
          _id: objectId(18, outcomeIndex * 3 + questionIndex + 1),
          attemptId: attemptIds[outcomeIndex],
          questionId: questionIds[purchase.trainingIndex * 3 + questionIndex],
          selectedOptionIds: ['a'],
          awardedPoints: 1,
          snapshot: {
            order: questionIndex + 1,
            points: 1,
            prompt: [
              `Quel est le rôle principal de la structure étudiée dans ${trainingData[purchase.trainingIndex]![0]} ?`,
              `Quelle pratique améliore directement la qualité d'un projet ${trainingData[purchase.trainingIndex]![0]} ?`,
              `Quel contrôle permet de valider les acquis en ${trainingData[purchase.trainingIndex]![0]} ?`,
            ][questionIndex],
            explanation:
              'La réponse attendue correspond aux notions et pratiques présentées.',
            type: 'SINGLE_CHOICE' as const,
            options: [
              {
                id: 'a',
                text: [
                  'Organiser les données et les responsabilités',
                  'Tester le comportement attendu',
                  'Comparer le résultat aux critères définis',
                ][questionIndex]!,
              },
              {
                id: 'b',
                text: [
                  'Supprimer les contrôles',
                  'Modifier le code sans vérification',
                  'Ignorer les critères de réussite',
                ][questionIndex]!,
              },
              {
                id: 'c',
                text: [
                  'Travailler sans objectif',
                  'Éviter les cas limites',
                  'Reporter toute validation',
                ][questionIndex]!,
              },
            ],
            correctOptionIds: ['a'],
          },
        })),
      ),
    );
    const certificateIds = outcomePurchases.map((_, index) =>
      objectId(19, index + 1),
    );
    await CertificateModel.insertMany(
      outcomePurchases.map((purchase, index) => {
        const purchaseIndex = outcomeIndexes[index]!;
        const [firstName, lastName] = learnerNames[purchase.learnerIndex]!;
        const sessionIndex = purchase.sessionId
          ? sessionIds.findIndex((id) => id.equals(purchase.sessionId))
          : -1;
        return {
          _id: certificateIds[index],
          enrollmentId: enrollmentIds[purchaseIndex],
          learnerId: purchase.learnerId,
          trainingId: purchase.trainingId,
          ...(purchase.sessionId ? { sessionId: purchase.sessionId } : {}),
          number: `DEV-CERT-${String(index + 1).padStart(4, '0')}`,
          issuedAt: date(0, 2 + (index % 20)),
          learner: {
            email: `apprenant${String(purchase.learnerIndex + 1).padStart(2, '0')}@formation.test`,
            firstName,
            lastName,
          },
          training: {
            title: trainingData[purchase.trainingIndex]![0],
            type: purchase.purchaseType,
            durationMinutes:
              purchase.purchaseType === 'IN_PERSON'
                ? 840
                : 600 + purchase.trainingIndex * 30,
            enrolledAt: date(-3),
            ...(purchase.sessionId
              ? {
                  sessionTitle: sessionTitle(purchase.trainingIndex, 0),
                  startsAt: date(-2, 8 + sessionIndex),
                  endsAt: date(-2, 9 + sessionIndex),
                }
              : {}),
          },
          eligibility: {
            completionPercentage: 100,
            completedAt: date(-1),
            ...(purchase.purchaseType === 'SELF_PACED_ONLINE'
              ? {
                  certifyingEvaluationId: evaluationIdByTrainingIndex.get(
                    purchase.trainingIndex,
                  ),
                  passedAttemptId:
                    attemptIds[evaluatedOutcomePurchases.indexOf(purchase)],
                }
              : {}),
            passedAt: date(-1),
          },
          issuer,
        };
      }),
    );
    await FeedbackModel.insertMany(
      outcomePurchases.map((purchase, index) => ({
        _id: objectId(20, index + 1),
        enrollmentId: enrollmentIds[outcomeIndexes[index]!],
        trainingId: purchase.trainingId,
        learnerId: purchase.learnerId,
        rating: 4 + (index % 2),
      })),
    );
    const now = new Date();
    await TrainerCostModel.insertMany(
      trainerIds.flatMap((trainerId, trainerIndex) =>
        Array.from({ length: 6 }, (_, offset) => {
          const period = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
          );
          return {
            _id: objectId(21, trainerIndex * 6 + offset + 1),
            trainerId,
            year: period.getUTCFullYear(),
            month: period.getUTCMonth() + 1,
            amountMinor: 12_000 + trainerIndex * 1_500,
            currency: 'EUR' as const,
            note: 'Coût mensuel de démonstration',
          };
        }),
      ),
    );
    await TrainingCostModel.insertMany(
      trainingIds.map((trainingId, index) => ({
        _id: objectId(22, index + 1),
        trainingId,
        ...(index >= 10 ? { sessionId: sessionIds[(index - 10) * 2] } : {}),
        incurredOn: date(-2 + (index % 3), 10),
        amountMinor: 3_000 + index * 500,
        currency: 'EUR' as const,
        label:
          index >= 10
            ? 'Location de salle et supports'
            : 'Production des ressources pédagogiques',
      })),
    );
    return {
      users: 1 + trainerIds.length + learnerIds.length,
      categories: categoryIds.length,
      trainings: trainingIds.length,
      modules: moduleIds.length,
      lessons: lessonIds.length,
      resources: lessonIds.length,
      sessions: sessionIds.length,
      schedules: scheduleIds.length,
      payments: paidPurchases.length + 12,
      enrollments: enrollmentIds.length,
      invoices: invoiceIds.length,
      evaluations: evaluationIds.length,
      attempts: attemptIds.length,
      certificates: certificateIds.length,
    };
  } finally {
    await mongoose.disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  seedDevelopmentData()
    .then((summary) => console.info('Development seed completed.', summary))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
