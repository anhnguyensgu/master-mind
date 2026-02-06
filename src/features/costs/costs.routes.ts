import { withAuth } from '../auth/auth.middleware';
import {
  getCostSummaryHandler,
  queryCostsHandler,
  getCostsByServiceHandler,
  listProvidersHandler,
  validateProviderHandler,
} from './costs.handlers';

export const costsRoutes = {
  '/api/costs/summary': { GET: withAuth(getCostSummaryHandler) },
  '/api/costs/query': { POST: withAuth(queryCostsHandler) },
  '/api/costs/by-service': { GET: withAuth(getCostsByServiceHandler) },
  '/api/costs/providers': { GET: withAuth(listProvidersHandler) },
  '/api/costs/validate': { POST: withAuth(validateProviderHandler) },
};
