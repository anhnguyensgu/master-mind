import type { AgentTool } from '../agent.types';
import type { CostApiConfig } from '../../config/config.types';
import { costApiOptionsFromConfig, costApiFetch } from './tool.types';

export function createCostSummaryTool(config: CostApiConfig): AgentTool {
  const options = costApiOptionsFromConfig(config);

  return {
    name: 'cost_summary',
    description:
      'Get a summary of cloud costs for a given time period. Returns total spending, top services, and period-over-period comparison.',
    inputSchema: {
      type: 'object',
      properties: {
        start: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (inclusive)',
        },
        end: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (exclusive)',
        },
        provider: {
          type: 'string',
          enum: ['aws', 'gcp', 'azure'],
          description: 'Cloud provider (defaults to configured default)',
        },
      },
      required: ['start', 'end'],
    },

    async execute(input) {
      try {
        const params = new URLSearchParams();
        params.set('start', input.start as string);
        params.set('end', input.end as string);
        if (input.provider) {
          params.set('provider', input.provider as string);
        }

        const data = await costApiFetch(options, `/api/costs/summary?${params}`);
        return { content: JSON.stringify(data, null, 2) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: `Failed to fetch cost summary: ${message}`, isError: true };
      }
    },
  };
}
