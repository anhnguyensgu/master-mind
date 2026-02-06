import { test, expect, beforeAll, afterAll } from 'bun:test';
import type { SuccessResponse, ErrorResponse } from '../../shared/response';
import type { CostResult } from './costs.types';
import { authRoutes } from '../auth/auth.routes';
import { costsRoutes } from './costs.routes';
import { handleError } from '../../shared/error';
import { getCostProviderRegistry } from './costs.provider-registry';
import { MockCostProvider } from './providers/mock.provider';

let server: ReturnType<typeof Bun.serve>;
let authToken: string;
const BASE_URL = 'http://localhost:3003';

beforeAll(async () => {
  // Register mock provider directly
  const registry = getCostProviderRegistry();
  registry.registerProvider(new MockCostProvider());

  const allRoutes = { ...authRoutes, ...costsRoutes };
  const routes: Record<
    string,
    Record<string, (req: Request) => Response | Promise<Response>>
  > = {};

  for (const [path, methods] of Object.entries(allRoutes)) {
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

  server = Bun.serve({ port: 3003, routes });

  // Register a user and get a token
  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'cost-test@example.com',
      password: 'password123',
      name: 'Cost Tester',
    }),
  });
  const registerData = (await registerRes.json()) as {
    data: { token: string };
  };
  authToken = registerData.data.token;
});

afterAll(() => {
  server.stop();
});

// Auth requirement
test('GET /api/costs/summary - should return 401 without token', async () => {
  const res = await fetch(
    `${BASE_URL}/api/costs/summary?start=2026-01-01&end=2026-02-01`
  );
  expect(res.status).toBe(401);
});

// Validation
test('GET /api/costs/summary - should require start and end params', async () => {
  const res = await fetch(`${BASE_URL}/api/costs/summary`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  expect(res.status).toBe(400);
  const data = (await res.json()) as ErrorResponse;
  expect(data.error.code).toBe('VALIDATION_ERROR');
});

test('GET /api/costs/summary - should reject invalid date format', async () => {
  const res = await fetch(
    `${BASE_URL}/api/costs/summary?start=not-a-date&end=2026-02-01`,
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  expect(res.status).toBe(400);
});

// Summary endpoint
test('GET /api/costs/summary - should return cost data', async () => {
  const res = await fetch(
    `${BASE_URL}/api/costs/summary?start=2026-01-01&end=2026-01-03&granularity=DAILY`,
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  expect(res.status).toBe(200);
  const data = (await res.json()) as SuccessResponse<CostResult>;
  expect(data.success).toBe(true);
  expect(data.data.provider).toBe('aws');
  expect(data.data.grandTotal.amount).toBeGreaterThan(0);
  expect(data.data.grandTotal.unit).toBe('USD');
  expect(data.data.timePeriods.length).toBe(2); // 2 days
  expect(data.data.currency).toBe('USD');
  expect(data.data.fetchedAt).toBeDefined();
});

// POST query with groupBy
test('POST /api/costs/query - should return grouped cost data', async () => {
  const res = await fetch(`${BASE_URL}/api/costs/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      start: '2026-01-01',
      end: '2026-02-01',
      granularity: 'MONTHLY',
      groupBy: [{ dimension: 'SERVICE' }],
    }),
  });
  expect(res.status).toBe(200);
  const data = (await res.json()) as SuccessResponse<CostResult>;
  expect(data.data.timePeriods.length).toBeGreaterThan(0);
  const entries = data.data.timePeriods[0]!.entries;
  expect(entries.length).toBeGreaterThan(1);
  expect(entries[0]!.keys[0]!.dimension).toBe('SERVICE');
});

// Reject >2 groupBy
test('POST /api/costs/query - should reject more than 2 groupBy', async () => {
  const res = await fetch(`${BASE_URL}/api/costs/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      start: '2026-01-01',
      end: '2026-02-01',
      groupBy: [
        { dimension: 'SERVICE' },
        { dimension: 'REGION' },
        { dimension: 'ACCOUNT' },
      ],
    }),
  });
  expect(res.status).toBe(400);
  const data = (await res.json()) as ErrorResponse;
  expect(data.error.code).toBe('VALIDATION_ERROR');
});

// By-service endpoint
test('GET /api/costs/by-service - should return SERVICE grouped data', async () => {
  const res = await fetch(
    `${BASE_URL}/api/costs/by-service?start=2026-01-01&end=2026-02-01`,
    { headers: { Authorization: `Bearer ${authToken}` } }
  );
  expect(res.status).toBe(200);
  const data = (await res.json()) as SuccessResponse<CostResult>;
  expect(data.data.timePeriods[0]!.entries[0]!.keys[0]!.dimension).toBe(
    'SERVICE'
  );
});

// List providers
test('GET /api/costs/providers - should list configured providers', async () => {
  const res = await fetch(`${BASE_URL}/api/costs/providers`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  expect(res.status).toBe(200);
  const data = (await res.json()) as SuccessResponse<{
    providers: string[];
    default: string;
  }>;
  expect(data.data.providers).toContain('aws');
});

// Validate provider
test('POST /api/costs/validate - should validate mock provider', async () => {
  const res = await fetch(`${BASE_URL}/api/costs/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(200);
  const data = (await res.json()) as SuccessResponse<{
    provider: string;
    valid: boolean;
  }>;
  expect(data.data.valid).toBe(true);
  expect(data.data.provider).toBe('aws');
});

// Two-dimension groupBy
test('POST /api/costs/query - should support two groupBy dimensions', async () => {
  const res = await fetch(`${BASE_URL}/api/costs/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      start: '2026-01-01',
      end: '2026-02-01',
      granularity: 'MONTHLY',
      groupBy: [{ dimension: 'SERVICE' }, { dimension: 'REGION' }],
    }),
  });
  expect(res.status).toBe(200);
  const data = (await res.json()) as SuccessResponse<CostResult>;
  const entry = data.data.timePeriods[0]!.entries[0]!;
  expect(entry.keys.length).toBe(2);
  expect(entry.keys[0]!.dimension).toBe('SERVICE');
  expect(entry.keys[1]!.dimension).toBe('REGION');
});
