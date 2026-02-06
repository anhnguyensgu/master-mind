import { test, expect, beforeAll, afterAll } from "bun:test";
import type { SuccessResponse } from "../../shared/response";
import { healthRoutes } from "./health.routes";

let server: ReturnType<typeof Bun.serve>;
const BASE_URL = "http://localhost:3002";

beforeAll(async () => {
  server = Bun.serve({
    port: 3002,
    routes: healthRoutes,
  });
});

afterAll(async () => {
  server.stop();
});

test("GET / - should return 200", async () => {
  const res = await fetch(`${BASE_URL}`);
  expect(res.status).toBe(200);
  const data = (await res.json()) as SuccessResponse<{ status: string }>;
  expect(data.success).toBe(true);
  expect(data.data.status).toBe("healthy");
});
