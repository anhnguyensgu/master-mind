import { successResponse } from '../../shared/response';

export function healthHandler(): Response {
  return successResponse({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}
