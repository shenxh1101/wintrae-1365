import { fail, HttpCode } from '../utils/response.js';

export function notFoundHandler(req, res, next) {
  res.status(HttpCode.NOT_FOUND).json(
    fail(`路由 ${req.method} ${req.originalUrl} 不存在`, HttpCode.NOT_FOUND)
  );
}

export function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development';

  let statusCode = err.statusCode || err.code || HttpCode.INTERNAL_ERROR;
  let message = err.message || '服务器内部错误';

  if (err.name === 'ValidationError' || err.isJoi) {
    statusCode = HttpCode.BAD_REQUEST;
    const details = err.details || [];
    message = details.map(d => d.message).join('; ') || '参数验证失败';
  }

  if (err.name === 'UnauthorizedError') {
    statusCode = HttpCode.UNAUTHORIZED;
    message = err.message || '未授权';
  }

  if (statusCode > 505) {
    statusCode = HttpCode.INTERNAL_ERROR;
  }

  const response = fail(message, statusCode);

  if (isDev) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

export default {
  notFoundHandler,
  errorHandler
};
