export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export async function request(base, path, { token, body, method = 'GET', signal } = {}) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method, signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('The service is unavailable. Please try again.', 'NETWORK_ERROR', 0);
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error?.message || 'The request could not be completed.', data?.error?.code || 'REQUEST_FAILED', response.status);
  }
  if (!data) throw new ApiError('The service returned an invalid response.', 'INVALID_RESPONSE', response.status);
  return data;
}
