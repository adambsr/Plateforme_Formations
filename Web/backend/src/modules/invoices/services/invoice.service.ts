import type { HydratedDocument, QueryFilter } from 'mongoose';

import { ProtectedDocumentStorage } from '../../../infrastructure/files/protected-document-storage.js';
import { renderInvoicePdf } from '../../../infrastructure/pdf/invoice-pdf.js';
import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { InvoiceListInput } from '../../payments/dto/payment.dto.js';
import { InvoiceItemModel } from '../models/invoice-item.model.js';
import { InvoiceModel, type Invoice } from '../models/invoice.model.js';

function passwordReady(principal: AuthenticatedPrincipal): void {
  if (principal.mustChangePassword) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'The temporary password must be changed before continuing.',
    );
  }
}

export class InvoiceService {
  readonly #storage: ProtectedDocumentStorage;

  constructor(storage: ProtectedDocumentStorage) {
    this.#storage = storage;
  }

  async list(principal: AuthenticatedPrincipal, input: InvoiceListInput) {
    passwordReady(principal);
    this.#assertReader(principal);
    const filter: QueryFilter<Invoice> =
      principal.role === 'LEARNER' ? { learnerId: principal.userId } : {};
    const [invoices, total] = await Promise.all([
      InvoiceModel.find(filter)
        .sort({ issuedAt: -1, _id: -1 })
        .skip((input.page - 1) * input.pageSize)
        .limit(input.pageSize)
        .exec(),
      InvoiceModel.countDocuments(filter),
    ]);
    return {
      items: await Promise.all(invoices.map((invoice) => this.#view(invoice))),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async get(principal: AuthenticatedPrincipal, invoiceId: string) {
    const invoice = await this.#authorizedInvoice(principal, invoiceId);
    return await this.#view(invoice);
  }

  async downloadablePdf(
    principal: AuthenticatedPrincipal,
    invoiceId: string,
  ): Promise<{ absolutePath: string; filename: string }> {
    let invoice = await this.#authorizedInvoice(principal, invoiceId);
    const item = await InvoiceItemModel.findOne({
      invoiceId: invoice._id,
    }).exec();
    if (item === null)
      throw new Error('Invoice item reference is inconsistent.');
    const hasReadablePdf =
      invoice.pdf !== undefined &&
      (await this.#storage.isReadable(invoice.pdf.relativePath));
    if (!hasReadablePdf) {
      const rendered = await renderInvoicePdf(invoice, item);
      const stored = await this.#storage.writeInvoice(
        String(invoice._id),
        rendered,
      );
      invoice =
        (await InvoiceModel.findByIdAndUpdate(
          invoice._id,
          { $set: { pdf: stored } },
          { returnDocument: 'after' },
        ).exec()) ?? invoice;
    }
    if (invoice.pdf === undefined) {
      throw new Error('Invoice PDF metadata was not persisted.');
    }
    return {
      absolutePath: this.#storage.resolve(invoice.pdf.relativePath),
      filename: `${invoice.number}.pdf`,
    };
  }

  async #authorizedInvoice(
    principal: AuthenticatedPrincipal,
    invoiceId: string,
  ): Promise<HydratedDocument<Invoice>> {
    passwordReady(principal);
    this.#assertReader(principal);
    const invoice = await InvoiceModel.findById(invoiceId).exec();
    if (
      invoice === null ||
      (principal.role === 'LEARNER' &&
        String(invoice.learnerId) !== principal.userId)
    ) {
      throw new AppError(
        404,
        'INVOICE_NOT_FOUND',
        'The Invoice does not exist.',
      );
    }
    return invoice;
  }

  async #view(invoice: HydratedDocument<Invoice>) {
    const item = await InvoiceItemModel.findOne({
      invoiceId: invoice._id,
    }).exec();
    if (item === null)
      throw new Error('Invoice item reference is inconsistent.');
    return {
      id: String(invoice._id),
      paymentId: String(invoice.paymentId),
      enrollmentId: String(invoice.enrollmentId),
      number: invoice.number,
      issuedAt: invoice.issuedAt.toISOString(),
      learner: invoice.learner,
      issuer: invoice.issuer,
      purchaseDescription: invoice.purchaseDescription,
      subtotalMinor: invoice.subtotalMinor,
      totalMinor: invoice.totalMinor,
      currency: invoice.currency,
      item: {
        id: String(item._id),
        description: item.description,
        quantity: item.quantity,
        unitAmountMinor: item.unitAmountMinor,
        totalMinor: item.totalMinor,
        currency: item.currency,
      },
      pdfDownloadUrl: `/api/invoices/${String(invoice._id)}/pdf`,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }

  #assertReader(principal: AuthenticatedPrincipal): void {
    if (principal.role === 'TRAINER') {
      throw new AppError(
        403,
        'FINANCIAL_ACCESS_FORBIDDEN',
        'Trainers do not have Invoice access.',
      );
    }
  }
}
