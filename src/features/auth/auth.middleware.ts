import type { SafeUser } from './auth.types';
import { ErrorCodes } from '../../shared/error';

// Simple token storage (in production, use proper JWT with secret)
const tokens = new Map<string, SafeUser>();

// Use WeakMap to store user data per request
const requestUserMap = new WeakMap<Request, SafeUser>();

export function setToken(token: string, user: SafeUser) {
  tokens.set(token, user);
}

export function getUserByToken(token: string): SafeUser | undefined {
  return tokens.get(token);
}

export function getRequestUser(req: Request): SafeUser | undefined {
  return requestUserMap.get(req);
}

export function setRequestUser(req: Request, user: SafeUser): void {
  requestUserMap.set(req, user);
}

// Higher-order function that wraps a handler with auth checking
export function withAuth(handler: (req: Request) => Response | Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Unauthorized: No token provided',
            code: ErrorCodes.NO_TOKEN,
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.substring(7);
    const user = getUserByToken(token);

    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Unauthorized: Invalid token',
            code: ErrorCodes.INVALID_TOKEN,
          },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    setRequestUser(req, user);
    return handler(req);
  };
}
