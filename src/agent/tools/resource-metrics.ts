import type { AgentTool } from '../agent.types';

type CloudProvider = 'aws' | 'gcp' | 'azure';

interface MetricCommand {
  cli: string;
  buildArgs(resourceId: string, metric: string, period: string, region?: string): string[];
}

const METRIC_COMMANDS: Record<CloudProvider, MetricCommand> = {
  aws: {
    cli: 'aws',
    buildArgs(resourceId, metric, period, region) {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - parsePeriod(period)).toISOString();

      const args = [
        'cloudwatch', 'get-metric-statistics',
        '--namespace', inferAwsNamespace(metric),
        '--metric-name', metric,
        '--dimensions', `Name=InstanceId,Value=${resourceId}`,
        '--start-time', startTime,
        '--end-time', endTime,
        '--period', '3600',
        '--statistics', 'Average', 'Maximum',
        '--output', 'json',
      ];
      if (region) args.push('--region', region);
      return args;
    },
  },
  gcp: {
    cli: 'gcloud',
    buildArgs(resourceId, metric, period) {
      return [
        'monitoring', 'metrics', 'list',
        `--filter=metric.type="${metric}" AND resource.labels.instance_id="${resourceId}"`,
        `--interval=${period}`,
        '--format=json',
      ];
    },
  },
  azure: {
    cli: 'az',
    buildArgs(resourceId, metric, period) {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - parsePeriod(period)).toISOString();

      return [
        'monitor', 'metrics', 'list',
        '--resource', resourceId,
        '--metric', metric,
        '--start-time', startTime,
        '--end-time', endTime,
        '--interval', 'PT1H',
        '--output', 'json',
      ];
    },
  },
};

// Common metric name mappings
const COMMON_METRICS: Record<CloudProvider, Record<string, string>> = {
  aws: {
    cpu: 'CPUUtilization',
    network_in: 'NetworkIn',
    network_out: 'NetworkOut',
    disk_read: 'DiskReadBytes',
    disk_write: 'DiskWriteBytes',
    memory: 'MemoryUtilization',
  },
  gcp: {
    cpu: 'compute.googleapis.com/instance/cpu/utilization',
    network_in: 'compute.googleapis.com/instance/network/received_bytes_count',
    network_out: 'compute.googleapis.com/instance/network/sent_bytes_count',
    disk_read: 'compute.googleapis.com/instance/disk/read_bytes_count',
    disk_write: 'compute.googleapis.com/instance/disk/write_bytes_count',
    memory: 'agent.googleapis.com/memory/percent_used',
  },
  azure: {
    cpu: 'Percentage CPU',
    network_in: 'Network In Total',
    network_out: 'Network Out Total',
    disk_read: 'Disk Read Bytes',
    disk_write: 'Disk Write Bytes',
    memory: 'Available Memory Bytes',
  },
};

function parsePeriod(period: string): number {
  const match = period.match(/^(\d+)([hdw])$/);
  if (!match) return 24 * 60 * 60 * 1000; // default 24h

  const value = parseInt(match[1]!, 10);
  switch (match[2]) {
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

function inferAwsNamespace(metric: string): string {
  if (metric.startsWith('CPU') || metric.startsWith('Network') || metric.startsWith('Disk')) {
    return 'AWS/EC2';
  }
  if (metric.startsWith('Database')) return 'AWS/RDS';
  if (metric.startsWith('Lambda')) return 'AWS/Lambda';
  return 'AWS/EC2';
}

const MAX_OUTPUT_LENGTH = 10_000;

export function createResourceMetricsTool(): AgentTool {
  return {
    name: 'resource_metrics',
    description:
      'Fetch utilization metrics for a cloud resource (CPU, memory, network, disk). Useful for identifying underutilized or over-provisioned resources. Supports AWS CloudWatch, GCP Monitoring, and Azure Monitor.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          enum: ['aws', 'gcp', 'azure'],
          description: 'Cloud provider',
        },
        resourceId: {
          type: 'string',
          description: 'Resource identifier (e.g., EC2 instance ID, GCE instance name)',
        },
        metric: {
          type: 'string',
          description:
            'Metric name. Use common names (cpu, memory, network_in, network_out, disk_read, disk_write) or provider-specific metric names.',
        },
        period: {
          type: 'string',
          description: 'Time period to query. Format: <number><unit> where unit is h (hours), d (days), w (weeks). Default: 24h',
        },
        region: {
          type: 'string',
          description: 'Region (optional, for AWS)',
        },
      },
      required: ['provider', 'resourceId', 'metric'],
    },

    async execute(input) {
      const provider = input.provider as CloudProvider;
      const resourceId = input.resourceId as string;
      let metric = input.metric as string;
      const period = (input.period as string) || '24h';
      const region = input.region as string | undefined;

      const command = METRIC_COMMANDS[provider];
      if (!command) {
        return { content: `Unknown provider: ${provider}`, isError: true };
      }

      // Resolve common metric names
      const commonMetrics = COMMON_METRICS[provider];
      if (commonMetrics && commonMetrics[metric.toLowerCase()]) {
        metric = commonMetrics[metric.toLowerCase()]!;
      }

      const args = command.buildArgs(resourceId, metric, period, region);

      try {
        const proc = Bun.spawn([command.cli, ...args], {
          stdout: 'pipe',
          stderr: 'pipe',
          env: process.env,
        });

        const timeoutId = setTimeout(() => proc.kill(), 60_000);

        const [stdout, stderr] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
        ]);

        clearTimeout(timeoutId);
        const exitCode = await proc.exited;

        let output = stdout || '';
        if (exitCode !== 0 && stderr) {
          output = stderr;
        }

        if (!output) {
          output = `No metrics data returned for ${metric} on ${resourceId}`;
        }

        if (output.length > MAX_OUTPUT_LENGTH) {
          output = output.slice(0, MAX_OUTPUT_LENGTH) + '\n...(truncated)';
        }

        return { content: output, isError: exitCode !== 0 };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: `Failed to fetch metrics: ${message}`, isError: true };
      }
    },
  };
}
