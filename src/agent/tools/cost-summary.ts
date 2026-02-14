import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { CostApiConfig } from '../../config/config.types';
import { costApiOptionsFromConfig, costApiFetch } from './tool.types';

export function createCostSummaryTool(config: CostApiConfig) {
  const options = costApiOptionsFromConfig(config);

  return createTool({
    id: 'cost_summary',
    description:
      'Get a summary of cloud costs for a given time period. Returns total spending, top services, and period-over-period comparison.',
    inputSchema: z.object({
      start: z.string().describe('Start date in YYYY-MM-DD format (inclusive)'),
      end: z.string().describe('End date in YYYY-MM-DD format (exclusive)'),
      provider: z.enum(['aws', 'gcp', 'azure']).optional().describe('Cloud provider (defaults to configured default)'),
    }),

    execute: async ({ context: { start, end, provider } }) => {
      try {
        const params = new URLSearchParams();
        params.set('start', start);
        params.set('end', end);
        if (provider) {
          params.set('provider', provider);
        }

        const data = await costApiFetch(options, `/api/costs/summary?${params}`);
        return { content: JSON.stringify(data, null, 2) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: `Failed to fetch cost summary: ${message}`, isError: true };
      }
    },
  });
}
