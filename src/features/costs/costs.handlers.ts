import type { GetCostsRequest, CostGranularity } from './costs.types';
import { successResponse } from '../../shared/response';
import { validationError } from '../../shared/error';
import { getCostProviderRegistry } from './costs.provider-registry';
import type { CloudProviderName } from './costs.types';

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

/** GET /api/costs/summary?start=...&end=...&granularity=...&provider=... */
export async function getCostSummaryHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const granularity = (
    url.searchParams.get('granularity') ?? 'DAILY'
  ).toUpperCase() as CostGranularity;
  const providerName = url.searchParams.get('provider') as
    | CloudProviderName
    | null;

  if (!start || !end) {
    throw validationError(
      'Query params "start" and "end" are required (YYYY-MM-DD)'
    );
  }
  if (!isValidDate(start) || !isValidDate(end)) {
    throw validationError('Invalid date format. Use YYYY-MM-DD');
  }
  if (granularity !== 'DAILY' && granularity !== 'MONTHLY') {
    throw validationError('Granularity must be DAILY or MONTHLY');
  }

  const registry = getCostProviderRegistry();
  const provider = registry.getProvider(providerName ?? undefined);

  const result = await provider.getCosts({
    dateRange: { start, end },
    granularity,
  });

  return successResponse(result);
}

/** POST /api/costs/query */
export async function queryCostsHandler(req: Request): Promise<Response> {
  const body = (await req.json()) as GetCostsRequest;

  if (!body.start || !body.end) {
    throw validationError(
      '"start" and "end" fields are required (YYYY-MM-DD)'
    );
  }
  if (!isValidDate(body.start) || !isValidDate(body.end)) {
    throw validationError('Invalid date format. Use YYYY-MM-DD');
  }

  const granularity = body.granularity ?? 'DAILY';
  if (granularity !== 'DAILY' && granularity !== 'MONTHLY') {
    throw validationError('Granularity must be DAILY or MONTHLY');
  }

  if (body.groupBy && body.groupBy.length > 2) {
    throw validationError('Maximum 2 groupBy dimensions allowed');
  }

  const registry = getCostProviderRegistry();
  const provider = registry.getProvider(body.provider);

  const result = await provider.getCosts({
    dateRange: { start: body.start, end: body.end },
    granularity,
    groupBy: body.groupBy,
    filters: body.filters,
  });

  return successResponse(result);
}

/** GET /api/costs/by-service?start=...&end=...&provider=... */
export async function getCostsByServiceHandler(
  req: Request
): Promise<Response> {
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const granularity = (
    url.searchParams.get('granularity') ?? 'MONTHLY'
  ).toUpperCase() as CostGranularity;
  const providerName = url.searchParams.get('provider') as
    | CloudProviderName
    | null;

  if (!start || !end) {
    throw validationError(
      'Query params "start" and "end" are required (YYYY-MM-DD)'
    );
  }
  if (!isValidDate(start) || !isValidDate(end)) {
    throw validationError('Invalid date format. Use YYYY-MM-DD');
  }

  const registry = getCostProviderRegistry();
  const provider = registry.getProvider(providerName ?? undefined);

  const result = await provider.getCosts({
    dateRange: { start, end },
    granularity,
    groupBy: [{ dimension: 'SERVICE' }],
  });

  return successResponse(result);
}

/** GET /api/costs/providers */
export async function listProvidersHandler(_req: Request): Promise<Response> {
  const registry = getCostProviderRegistry();
  const providers = registry.listProviders();

  return successResponse({
    providers,
    default: providers[0] ?? null,
  });
}

/** POST /api/costs/validate */
export async function validateProviderHandler(
  req: Request
): Promise<Response> {
  const body = (await req.json()) as { provider?: string };
  const registry = getCostProviderRegistry();
  const provider = registry.getProvider(body.provider as CloudProviderName);

  const valid = await provider.validateCredentials();

  return successResponse({
    provider: provider.name,
    valid,
  });
}
