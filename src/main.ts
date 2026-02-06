import { healthRoutes } from './features/health/health.routes';
import { authRoutes } from './features/auth/auth.routes';
import { costsRoutes } from './features/costs/costs.routes';
import { initializeCostProviders } from './features/costs/costs.provider-registry';
import { handleError } from './shared/error';

type RouteHandler = (req: Request) => Response | Promise<Response>;
type RouteMethods = Record<string, RouteHandler>;
type Routes = Record<string, RouteMethods>;

// Wrap all route handlers with global error handling
function withErrorHandling(routes: Routes): Routes {
  const wrapped: Routes = {};
  for (const [path, methods] of Object.entries(routes)) {
    wrapped[path] = {};
    for (const [method, handler] of Object.entries(methods)) {
      wrapped[path][method] = async (req: Request) => {
        try {
          return await handler(req);
        } catch (error) {
          return handleError(error);
        }
      };
    }
  }
  return wrapped;
}

function logRequest(req: Request, response: Response, duration: number): Response {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} -> ${response.status} (${duration}ms)`);
  response.headers.set('X-Response-Time', `${duration}ms`);
  return response;
}

const port = Number(Bun.env.PORT) || 3000;

await initializeCostProviders();

const server = Bun.serve({
  port,
  routes: withErrorHandling({ ...healthRoutes, ...authRoutes, ...costsRoutes }),

  async fetch(req) {
    const startTime = Date.now();

    try {
      const response = new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Not found',
            code: 'NOT_FOUND',
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );

      return logRequest(req, response, Date.now() - startTime);
    } catch (error) {
      const response = handleError(error);
      return logRequest(req, response, Date.now() - startTime);
    }
  },

  development: Bun.env.NODE_ENV !== 'production',
});

console.log(`Server running at http://localhost:${server.port}`);
console.log(`Health check: http://localhost:${server.port}/`);
console.log(`API endpoints:`);
console.log(`   POST   http://localhost:${server.port}/api/auth/register`);
console.log(`   POST   http://localhost:${server.port}/api/auth/login`);
console.log(`   GET    http://localhost:${server.port}/api/auth/me (protected)`);
console.log(`   GET    http://localhost:${server.port}/api/costs/summary (protected)`);
console.log(`   POST   http://localhost:${server.port}/api/costs/query (protected)`);
console.log(`   GET    http://localhost:${server.port}/api/costs/by-service (protected)`);
console.log(`   GET    http://localhost:${server.port}/api/costs/providers (protected)`);
console.log(`   POST   http://localhost:${server.port}/api/costs/validate (protected)`);
