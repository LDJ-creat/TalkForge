export class ShadowingServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ShadowingServiceError";
    this.status = status;
    this.code = code;
  }
}
