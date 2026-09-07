export function sendSuccess(res, { statusCode = 200, message = 'OK', data } = {}) {
  return res.status(statusCode).json({ success: true, message, data })
}

export function sendCreated(res, { message = 'Created', data } = {}) {
  return sendSuccess(res, { statusCode: 201, message, data })
}

export function sendNoContent(res) {
  return res.status(204).send()
}
