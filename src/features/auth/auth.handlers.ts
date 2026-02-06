import type { LoginRequest, RegisterRequest } from './auth.types';
import { successResponse } from '../../shared/response';
import { AppError, ErrorCodes, validationError, conflictError } from '../../shared/error';
import { setToken, getRequestUser } from './auth.middleware';
import { getUserRepository } from './auth.repository';

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function registerHandler(req: Request): Promise<Response> {
  const body = await req.json() as RegisterRequest;

  if (!body.email || !body.password || !body.name) {
    throw validationError('Email, password, and name are required');
  }

  const repo = getUserRepository();

  if (await repo.exists(body.email)) {
    throw conflictError('User with this email already exists', ErrorCodes.USER_EXISTS);
  }

  const hashedPassword = await Bun.password.hash(body.password);

  const user = await repo.create({
    email: body.email,
    password: hashedPassword,
    name: body.name,
  });

  const token = generateToken();
  setToken(token, user);

  return successResponse({ user, token }, 201);
}

export async function loginHandler(req: Request): Promise<Response> {
  const body = await req.json() as LoginRequest;

  if (!body.email || !body.password) {
    throw validationError('Email and password are required');
  }

  const user = await getUserRepository().verifyPassword(body.email, body.password);

  if (!user) {
    throw new AppError('Invalid email or password', ErrorCodes.INVALID_CREDENTIALS, 401);
  }

  const token = generateToken();
  setToken(token, user);

  return successResponse({ user, token });
}

export async function meHandler(req: Request): Promise<Response> {
  const user = getRequestUser(req);

  if (!user) {
    throw new AppError('Unauthorized', ErrorCodes.UNAUTHORIZED, 401);
  }

  return successResponse(user);
}
