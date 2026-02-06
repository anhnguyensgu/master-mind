import { healthHandler } from './health.handlers';

export const healthRoutes = {
  '/': { GET: healthHandler },
};
