export function success(data = null, message = '操作成功', code = 200) {
  return {
    success: true,
    message,
    code,
    data
  };
}

export function fail(message = '操作失败', code = 400, data = null) {
  return {
    success: false,
    message,
    code,
    data
  };
}

export const HttpCode = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500
};
