export class InvalidPlatformUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPlatformUploadError";
  }
}
