export class ReportServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ReportServiceError";
    this.status = status;
    this.code = code;
  }
}
