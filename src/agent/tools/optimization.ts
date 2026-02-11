import type { AgentTool } from '../agent.types';
import type { CostApiConfig } from '../../config/config.types';
import { costApiOptionsFromConfig, costApiFetch } from './tool.types';

export function createOptimizationTool(config: CostApiConfig): AgentTool {
  const options = costApiOptionsFromConfig(config);

  return {
    name: 'optimization_analyze',
    description:
      'Analyze cloud spending and generate optimization recommendations. Fetches cost data by service for the specified period, identifies top spending areas, and suggests concrete savings opportunities including rightsizing, reserved instances, and unused resource cleanup.',
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
        focusArea: {
          type: 'string',
          enum: ['compute', 'storage', 'database', 'network', 'all'],
          description: 'Area to focus analysis on (default: all)',
        },
      },
      required: ['start', 'end'],
    },

    async execute(input) {
      const start = input.start as string;
      const end = input.end as string;
      const provider = input.provider as string | undefined;
      const focusArea = (input.focusArea as string) || 'all';

      try {
        // Fetch cost by service
        const params = new URLSearchParams();
        params.set('start', start);
        params.set('end', end);
        if (provider) params.set('provider', provider);

        const serviceData = await costApiFetch(
          options,
          `/api/costs/by-service?${params}`,
        );

        // Fetch summary for comparison
        const summaryData = await costApiFetch(
          options,
          `/api/costs/summary?${params}`,
        );

        // Build analysis report
        const report = buildOptimizationReport(
          serviceData,
          summaryData,
          focusArea,
          { start, end },
        );

        return { content: report };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: `Failed to analyze costs: ${message}. Make sure the cost API server is running.`,
          isError: true,
        };
      }
    },
  };
}

function buildOptimizationReport(
  serviceData: unknown,
  summaryData: unknown,
  focusArea: string,
  period: { start: string; end: string },
): string {
  const sections: string[] = [];

  sections.push(`# Cost Optimization Analysis`);
  sections.push(`Period: ${period.start} to ${period.end}`);
  sections.push(`Focus: ${focusArea}`);
  sections.push('');

  // Summary
  sections.push('## Summary');
  sections.push('```json');
  sections.push(JSON.stringify(summaryData, null, 2));
  sections.push('```');
  sections.push('');

  // Service breakdown
  sections.push('## Cost by Service');
  sections.push('```json');
  sections.push(JSON.stringify(serviceData, null, 2));
  sections.push('```');
  sections.push('');

  // General recommendations based on focus area
  sections.push('## Optimization Opportunities');
  sections.push('');

  if (focusArea === 'all' || focusArea === 'compute') {
    sections.push('### Compute');
    sections.push('- **Rightsizing**: Check for instances with consistently low CPU/memory utilization (<20%) using the resource_metrics tool');
    sections.push('- **Reserved Instances / Savings Plans**: For stable workloads running 24/7, consider 1-year or 3-year commitments (up to 72% savings)');
    sections.push('- **Spot Instances**: For fault-tolerant batch workloads, spot instances offer up to 90% savings');
    sections.push('- **Auto Scaling**: Ensure auto-scaling is configured for variable workloads');
    sections.push('');
  }

  if (focusArea === 'all' || focusArea === 'storage') {
    sections.push('### Storage');
    sections.push('- **Lifecycle Policies**: Move infrequently accessed data to cheaper storage tiers (S3 IA, Glacier, Nearline, Cool)');
    sections.push('- **Unused Volumes**: Check for unattached EBS volumes or persistent disks');
    sections.push('- **Snapshot Cleanup**: Remove old, unnecessary snapshots');
    sections.push('');
  }

  if (focusArea === 'all' || focusArea === 'database') {
    sections.push('### Database');
    sections.push('- **Reserved Instances**: RDS/Cloud SQL reserved instances for stable databases');
    sections.push('- **Rightsizing**: Check for over-provisioned database instances');
    sections.push('- **Serverless Options**: Consider Aurora Serverless or Cloud Spanner for variable workloads');
    sections.push('');
  }

  if (focusArea === 'all' || focusArea === 'network') {
    sections.push('### Network');
    sections.push('- **Data Transfer**: Review cross-region and cross-AZ data transfer costs');
    sections.push('- **NAT Gateway**: High NAT gateway costs may indicate architecture improvements needed');
    sections.push('- **CDN Usage**: Use CloudFront/Cloud CDN for frequently accessed content');
    sections.push('');
  }

  sections.push('## Next Steps');
  sections.push('Use the resource_list and resource_metrics tools to drill into specific resources identified above.');

  return sections.join('\n');
}
