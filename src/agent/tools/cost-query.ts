import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { CostApiConfig } from '../../config/config.types';
import { costApiOptionsFromConfig, costApiFetch } from './tool.types';

export function createCostQueryTool(config: CostApiConfig) {
  const options = costApiOptionsFromConfig(config);

  return createTool({
    id: 'cost_query',
    description:
      'Run a custom cost query with grouping and filtering. Supports grouping by SERVICE, RESOURCE, TAG, REGION, or ACCOUNT, and filtering by any of those dimensions. Use this for advanced cost analysis.',
    inputSchema: z.object({
      start: z.string().describe('Start date in YYYY-MM-DD format (inclusive)'),
      end: z.string().describe('End date in YYYY-MM-DD format (exclusive)'),
      granularity: z.enum(['DAILY', 'MONTHLY']).optional().describe('Time granularity (default: MONTHLY)'),
      groupBy: z.array(z.object({
        dimension: z.enum(['SERVICE', 'RESOURCE', 'TAG', 'REGION', 'ACCOUNT']),
        tagKey: z.string().optional().describe('Required when dimension is TAG'),
      })).optional().describe('Dimensions to group results by'),
      filters: z.array(z.object({
        dimension: z.enum(['SERVICE', 'RESOURCE', 'TAG', 'REGION', 'ACCOUNT']),
        values: z.array(z.string()),
        tagKey: z.string().optional().describe('Required when dimension is TAG'),
      })).optional().describe('Filters to apply'),
      provider: z.enum(['aws', 'gcp', 'azure']).optional().describe('Cloud provider (defaults to configured default)'),
    }),

    execute: async ({ context: { start, end, granularity, groupBy, filters, provider } }) => {
      try {
        const body = {
          dateRange: { start, end },
          granularity: granularity || 'MONTHLY',
          groupBy,
          filters,
          provider,
        };

        const data = await costApiFetch(options, '/api/costs/query', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return { content: JSON.stringify(data, null, 2) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: `Failed to query costs: ${message}`, isError: true };
      }
    },
  });
}
