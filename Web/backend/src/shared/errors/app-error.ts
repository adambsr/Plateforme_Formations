export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors: readonly FieldError[] | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: readonly FieldError[],
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
