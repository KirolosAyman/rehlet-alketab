// Error type every handler throws. `message` is Arabic, user-facing, actionable.
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const unauthorized = () => new ApiError('unauthorized', 'الجلسة انتهت. سجّل دخول تاني.', 401);
export const notFound = (msg = 'العنصر ده مش موجود (ممكن يكون اتمسح).') => new ApiError('not_found', msg, 404);
export const conflict = (code: string, msg: string) => new ApiError(code, msg, 409);
export const badInput = (msg: string) => new ApiError('bad_input', msg, 400);
