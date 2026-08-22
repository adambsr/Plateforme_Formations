import mongoose, { type Model, type Types } from 'mongoose';

export interface InvoiceItem {
  invoiceId: Types.ObjectId;
  description: string;
  quantity: 1;
  unitAmountMinor: number;
  totalMinor: number;
  currency: 'TND';
  createdAt: Date;
  updatedAt: Date;
}

const invoiceItemSchema = new mongoose.Schema<InvoiceItem>(
  {
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Invoice',
    },
    description: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 500,
    },
    quantity: { type: Number, required: true, enum: [1] },
    unitAmountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    totalMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    currency: { type: String, required: true, enum: ['TND'] },
  },
  {
    collection: 'invoice_items',
    strict: 'throw',
    timestamps: true,
  },
);

invoiceItemSchema.index(
  { invoiceId: 1 },
  { unique: true, name: 'one_purchase_line_per_invoice' },
);

export const InvoiceItemModel =
  (mongoose.models.InvoiceItem as Model<InvoiceItem> | undefined) ??
  mongoose.model<InvoiceItem>('InvoiceItem', invoiceItemSchema);
