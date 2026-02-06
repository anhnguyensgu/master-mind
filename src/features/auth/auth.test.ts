import { test, expect, beforeAll, afterAll } from "bun:test";
import type { AuthResponse } from "./auth.types";
import type { ErrorResponse } from "../../shared/response";
import { authRoutes } from "./auth.routes";
import { healthRoutes } from "../health/health.routes";
import { handleError } from "../../shared/error";

let server: ReturnType<typeof Bun.serve>;
const BASE_URL = "http://localhost:3001";

beforeAll(async () => {
  const routes: Record<string, Record<string, (req: Request) => Response | Promise<Response>>> = {};

  for (const [path, methods] of Object.entries({ ...healthRoutes, ...authRoutes })) {
    routes[path] = {};
    for (const [method, handler] of Object.entries(methods)) {
      routes[path][method] = async (req: Request) => {
        try {
          return await handler(req);
        } catch (error) {
          return handleError(error);
        }
      };
    }
  }

  server = Bun.serve({
    port: 3001,
    routes,
  });
});

afterAll(async () => {
  server.stop();
});

// Auth tests
test("POST /api/auth/register - should register new user", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test@example.com",
      password: "password123",
      name: "Test User",
    }),
  });

  expect(res.status).toBe(201);
  const data = (await res.json()) as AuthResponse;
  expect(data.success).toBe(true);
  expect(data.data.user.email).toBe("test@example.com");
  expect(data.data.token).toBeDefined();
});

test("POST /api/auth/register - should reject duplicate email", async () => {
  await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "duplicate@example.com",
      password: "password123",
      name: "First User",
    }),
  });

  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "duplicate@example.com",
      password: "password456",
      name: "Second User",
    }),
  });

  expect(res.status).toBe(409);
  const data = (await res.json()) as ErrorResponse;
  expect(data.success).toBe(false);
  expect(data.error.code).toBe("USER_EXISTS");
});

test("POST /api/auth/register - should validate required fields", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test@example.com",
    }),
  });

  expect(res.status).toBe(400);
  const data = (await res.json()) as ErrorResponse;
  expect(data.success).toBe(false);
  expect(data.error.code).toBe("VALIDATION_ERROR");
});

test("POST /api/auth/login - should login with valid credentials", async () => {
  await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "login@example.com",
      password: "password123",
      name: "Login User",
    }),
  });

  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "login@example.com",
      password: "password123",
    }),
  });

  expect(res.status).toBe(200);
  const data = (await res.json()) as AuthResponse;
  expect(data.success).toBe(true);
  expect(data.data.user.email).toBe("login@example.com");
  expect(data.data.token).toBeDefined();
});

test("POST /api/auth/login - should reject invalid credentials", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "nonexistent@example.com",
      password: "wrongpassword",
    }),
  });

  expect(res.status).toBe(401);
  const data = (await res.json()) as ErrorResponse;
  expect(data.success).toBe(false);
  expect(data.error.code).toBe("INVALID_CREDENTIALS");
});

test("POST /api/auth/login - should validate required fields", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test@example.com",
    }),
  });

  expect(res.status).toBe(400);
  const data = (await res.json()) as ErrorResponse;
  expect(data.success).toBe(false);
  expect(data.error.code).toBe("VALIDATION_ERROR");
});

test("POST /api/auth/login - should handle invalid JSON", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "invalid json",
  });

  expect(res.status).toBe(400);
  const data = (await res.json()) as ErrorResponse;
  expect(data.success).toBe(false);
  expect(data.error.code).toBe("INVALID_JSON");
});

test("GET /api/auth/me - should return 401 without auth token", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  expect(res.status).toBe(401);
  const data = (await res.json()) as ErrorResponse;
  expect(data.success).toBe(false);
});

test("GET /api/auth/me - should return current user with valid token", async () => {
  const email = "me@example.com";
  const password = "password123";
  const name = "Me Test";

  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });

  expect(registerRes.status).toBe(201);
  const registerData = (await registerRes.json()) as AuthResponse;
  const token = registerData.data.token;

  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  expect(res.status).toBe(200);
  const data = (await res.json()) as { success: true; data: { email: string; name: string; id: string; password?: string } };
  expect(data.success).toBe(true);
  expect(data.data.email).toBe(email);
  expect(data.data.name).toBe(name);
  expect(data.data.id).toBeDefined();
  expect((data.data as any).password).toBeUndefined();
});
