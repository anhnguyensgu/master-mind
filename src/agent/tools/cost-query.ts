import type { AgentTool } from '../agent.types';
import type { CostApiConfig } from '../../config/config.types';
import { costApiOptionsFromConfig, costApiFetch } from './tool.types';

export function createCostQueryTool(config: CostApiConfig): AgentTool {
  const options = costApiOptionsFromConfig(config);

  return {
    name: 'cost_query',
    description:
      'Run a custom cost query with grouping and filtering. Supports grouping by SERVICE, RESOURCE, TAG, REGION, or ACCOUNT, and filtering by any of those dimensions. Use this for advanced cost analysis.',
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
        granularity: {
          type: 'string',
          enum: ['DAILY', 'MONTHLY'],
          description: 'Time granularity (default: MONTHLY)',
        },
        groupBy: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dimension: {
                type: 'string',
                enum: ['SERVICE', 'RESOURCE', 'TAG', 'REGION', 'ACCOUNT'],
              },
              tagKey: {
                type: 'string',
                description: 'Required when dimension is TAG',
              },
            },
            required: ['dimension'],
          },
          description: 'Dimensions to group results by',
        },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dimension: {
                type: 'string',
                enum: ['SERVICE', 'RESOURCE', 'TAG', 'REGION', 'ACCOUNT'],
              },
              values: {
                type: 'array',
                items: { type: 'string' },
              },
              tagKey: {
                type: 'string',
                description: 'Required when dimension is TAG',
              },
            },
            required: ['dimension', 'values'],
          },
          description: 'Filters to apply',
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
        const body = {
          dateRange: {
            start: input.start as string,
            end: input.end as string,
          },
          granularity: (input.granularity as string) || 'MONTHLY',
          groupBy: input.groupBy,
          filters: input.filters,
          provider: input.provider,
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
  };
}
