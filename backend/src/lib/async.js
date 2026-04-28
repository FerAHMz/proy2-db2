export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg, code) => new HttpError(400, msg, code);
export const notFound = (msg = 'Not found', code) => new HttpError(404, msg, code);
