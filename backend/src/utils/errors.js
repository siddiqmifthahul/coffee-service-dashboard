export class ApiError extends Error {
  constructor(statusCode, message, errors) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export const badRequest = (msg, errors) => new ApiError(400, msg, errors);
export const unauthorized = (msg = 'Silakan login terlebih dahulu.') => new ApiError(401, msg);
export const forbidden = (msg = 'Anda tidak memiliki akses untuk aksi ini.') => new ApiError(403, msg);
export const notFound = (msg = 'Data tidak ditemukan.') => new ApiError(404, msg);
export const unprocessable = (msg, errors) => new ApiError(422, msg, errors);

/** Bungkus handler async agar error diteruskan ke error middleware */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
