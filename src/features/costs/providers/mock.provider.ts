import type {
  CloudCostProvider,
  CostQuery,
  CostResult,
  CostTimePeriod,
  CostEntry,
  CostAmount,
  CostGroupKey,
  CostGroupByDimension,
  ProviderConfig,
} from '../costs.types';

const MOCK_SERVICES = [
  'Amazon EC2',
  'Amazon S3',
  'AWS Lambda',
  'Amazon RDS',
  'Amazon CloudFront',
  'Amazon DynamoDB',
];

const MOCK_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'ap-southeast-1',
];

const MOCK_ACCOUNTS = ['111111111111', '222222222222', '333333333333'];

const MOCK_TAGS: Record<string, string[]> = {
  Environment: ['production', 'staging', 'development'],
  Team: ['backend', 'frontend', 'data', 'infra'],
  Project: ['api', 'dashboard', 'pipeline'],
};

/** Deterministic seed from a string for repeatable mock data */
function hashSeed(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateDays(start: string, end: string): { start: string; end: string }[] {
  const periods: { start: string; end: string }[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current < endDate) {
    const next = new Date(current);
    next.setDate(next.getDate() + 1);
    periods.push({
      start: current.toISOString().split('T')[0]!,
      end: next.toISOString().split('T')[0]!,
    });
    current.setDate(current.getDate() + 1);
  }
  return periods;
}

function generateMonths(start: string, end: string): { start: string; end: string }[] {
  const periods: { start: string; end: string }[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  // Snap to first of month
  current.setDate(1);
  while (current < endDate) {
    const next = new Date(current);
    next.setMonth(next.getMonth() + 1);
    periods.push({
      start: current.toISOString().split('T')[0]!,
      end: next.toISOString().split('T')[0]!,
    });
    current.setMonth(current.getMonth() + 1);
  }
  return periods;
}

function valuesForDimension(
  dim: CostGroupByDimension,
  tagKey?: string
): string[] {
  switch (dim) {
    case 'SERVICE':
      return MOCK_SERVICES;
    case 'REGION':
      return MOCK_REGIONS;
    case 'ACCOUNT':
      return MOCK_ACCOUNTS;
    case 'RESOURCE':
      return ['i-0abc123', 'i-0def456', 'bucket-prod', 'db-main'];
    case 'TAG':
      return MOCK_TAGS[tagKey ?? 'Environment'] ?? ['unknown'];
  }
}

function buildEntries(
  periodStart: string,
  groupBy?: CostQuery['groupBy'],
  filters?: CostQuery['filters']
): CostEntry[] {
  if (!groupBy || groupBy.length === 0) {
    // No grouping — single entry
    const seed = hashSeed(periodStart);
    const amount = 50 + (seed % 200) + ((seed % 100) / 100);
    return [
      {
        keys: [],
        total: { amount: Math.round(amount * 100) / 100, unit: 'USD', estimated: false },
        metrics: {
          UnblendedCost: { amount: Math.round(amount * 100) / 100, unit: 'USD', estimated: false },
          BlendedCost: {
            amount: Math.round((amount * 1.02) * 100) / 100,
            unit: 'USD',
            estimated: false,
          },
        },
      },
    ];
  }

  // Get values for first dimension
  const dim1 = groupBy[0]!;
  let values1 = valuesForDimension(dim1.dimension, dim1.tagKey);

  // Apply filters
  if (filters) {
    for (const f of filters) {
      if (f.dimension === dim1.dimension) {
        values1 = values1.filter((v) => f.values.includes(v));
      }
    }
  }

  const entries: CostEntry[] = [];

  if (groupBy.length === 1) {
    for (const val of values1) {
      const seed = hashSeed(`${periodStart}-${val}`);
      const amount = 10 + (seed % 150) + ((seed % 100) / 100);
      const key: CostGroupKey = {
        dimension: dim1.dimension,
        value: val,
        ...(dim1.tagKey ? { tagKey: dim1.tagKey } : {}),
      };
      entries.push({
        keys: [key],
        total: { amount: Math.round(amount * 100) / 100, unit: 'USD', estimated: false },
        metrics: {
          UnblendedCost: { amount: Math.round(amount * 100) / 100, unit: 'USD', estimated: false },
          BlendedCost: {
            amount: Math.round((amount * 1.02) * 100) / 100,
            unit: 'USD',
            estimated: false,
          },
        },
      });
    }
  } else {
    // Two dimensions
    const dim2 = groupBy[1]!;
    let values2 = valuesForDimension(dim2.dimension, dim2.tagKey);

    if (filters) {
      for (const f of filters) {
        if (f.dimension === dim2.dimension) {
          values2 = values2.filter((v) => f.values.includes(v));
        }
      }
    }

    for (const v1 of values1) {
      for (const v2 of values2) {
        const seed = hashSeed(`${periodStart}-${v1}-${v2}`);
        const amount = 5 + (seed % 80) + ((seed % 100) / 100);
        entries.push({
          keys: [
            {
              dimension: dim1.dimension,
              value: v1,
              ...(dim1.tagKey ? { tagKey: dim1.tagKey } : {}),
            },
            {
              dimension: dim2.dimension,
              value: v2,
              ...(dim2.tagKey ? { tagKey: dim2.tagKey } : {}),
            },
          ],
          total: { amount: Math.round(amount * 100) / 100, unit: 'USD', estimated: false },
          metrics: {
            UnblendedCost: { amount: Math.round(amount * 100) / 100, unit: 'USD', estimated: false },
            BlendedCost: {
              amount: Math.round((amount * 1.02) * 100) / 100,
              unit: 'USD',
              estimated: false,
            },
          },
        });
      }
    }
  }

  return entries;
}

export class MockCostProvider implements CloudCostProvider {
  readonly name = 'aws' as const;

  async getCosts(query: CostQuery): Promise<CostResult> {
    const periods =
      query.granularity === 'DAILY'
        ? generateDays(query.dateRange.start, query.dateRange.end)
        : generateMonths(query.dateRange.start, query.dateRange.end);

    let grandTotalAmount = 0;

    const timePeriods: CostTimePeriod[] = periods.map((p) => {
      const entries = buildEntries(p.start, query.groupBy, query.filters);
      const periodTotalAmount = entries.reduce((sum, e) => sum + e.total.amount, 0);
      grandTotalAmount += periodTotalAmount;

      return {
        start: p.start,
        end: p.end,
        entries,
        periodTotal: {
          amount: Math.round(periodTotalAmount * 100) / 100,
          unit: 'USD',
          estimated: false,
        },
      };
    });

    return {
      provider: this.name,
      query,
      timePeriods,
      grandTotal: {
        amount: Math.round(grandTotalAmount * 100) / 100,
        unit: 'USD',
        estimated: false,
      },
      currency: 'USD',
      fetchedAt: new Date().toISOString(),
    };
  }

  async validateCredentials(): Promise<boolean> {
    return true;
  }
}

export function createMockCostProvider(_config: ProviderConfig): MockCostProvider {
  return new MockCostProvider();
}
