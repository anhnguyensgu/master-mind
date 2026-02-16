import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const testTool = createTool({
  id: 'cost_query',
  description: 'Query cloud costs with filtering and grouping. Supports AWS, GCP, and Azure cost analysis.',
  inputSchema: z.object({
    start_date: z.string().describe('Start date in YYYY-MM-DD format'),
    end_date: z.string().describe('End date in YYYY-MM-DD format'),
    group_by: z.array(z.string()).optional().describe('Fields to group by (e.g., ["service", "resource_type"])'),
    filter: z.record(z.string()).optional().describe('Filters to apply (e.g., {"service": "Amazon DocumentDB"})'),
    provider: z.enum(['aws', 'gcp', 'azure']).optional().describe('Cloud provider (default: aws)'),
  }),

  execute: async ({ start_date, end_date, group_by, filter, provider }) => {
    const query = { start_date, end_date, group_by, filter, provider };
    console.log('[TEST COST TOOL] Received query:', JSON.stringify(query, null, 2));

    // Mock response
    return {
      content: JSON.stringify({
        message: 'Test cost query executed',
        query,
        mock_data: {
          total_cost: 1234.56,
          currency: 'USD',
          period: `${start_date} to ${end_date}`,
          breakdown: [
            { service: 'Amazon DocumentDB', cost: 856.32, percentage: 69.4 },
            { service: 'Amazon EC2', cost: 378.24, percentage: 30.6 }
          ]
        }
      }, null, 2)
    };
  },
});
