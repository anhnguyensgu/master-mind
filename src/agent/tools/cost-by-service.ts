import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { CostApiConfig } from '../../config/config.types';
import { costApiOptionsFromConfig, costApiFetch } from './tool.types';

export function createCostByServiceTool(config: CostApiConfig) {
  const options = costApiOptionsFromConfig(config);

  return createTool({
    id: 'cost_by_service',
    description:
      'Get cloud costs broken down by service (e.g., EC2, S3, RDS, Lambda). Useful for identifying which services are driving costs.',
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

        const data = await costApiFetch(options, `/api/costs/by-service?${params}`);
        return { content: JSON.stringify(data, null, 2) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: `Failed to fetch cost by service: ${message}`, isError: true };
      }
    },
  });
}
