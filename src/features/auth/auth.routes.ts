import { registerHandler, loginHandler, meHandler } from './auth.handlers';
import { withAuth } from './auth.middleware';

export const authRoutes = {
  '/api/auth/register': { POST: registerHandler },
  '/api/auth/login': { POST: loginHandler },
  '/api/auth/me': { GET: withAuth(meHandler) },
};
