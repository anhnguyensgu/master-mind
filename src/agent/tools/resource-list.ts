import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

type CloudProvider = 'aws' | 'gcp' | 'azure';

interface ResourceCommand {
  cli: string;
  args: string[];
}

const RESOURCE_COMMANDS: Record<CloudProvider, Record<string, ResourceCommand>> = {
  aws: {
    ec2: { cli: 'aws', args: ['ec2', 'describe-instances'] },
    s3: { cli: 'aws', args: ['s3api', 'list-buckets'] },
    rds: { cli: 'aws', args: ['rds', 'describe-db-instances'] },
    documentdb: { cli: 'aws', args: ['docdb', 'describe-db-clusters'] },
    lambda: { cli: 'aws', args: ['lambda', 'list-functions'] },
    ebs: { cli: 'aws', args: ['ec2', 'describe-volumes'] },
    elb: { cli: 'aws', args: ['elbv2', 'describe-load-balancers'] },
    ecs: { cli: 'aws', args: ['ecs', 'list-clusters'] },
    eks: { cli: 'aws', args: ['eks', 'list-clusters'] },
    dynamodb: { cli: 'aws', args: ['dynamodb', 'list-tables'] },
    elasticache: { cli: 'aws', args: ['elasticache', 'describe-cache-clusters'] },
    cloudfront: { cli: 'aws', args: ['cloudfront', 'list-distributions'] },
    sqs: { cli: 'aws', args: ['sqs', 'list-queues'] },
    sns: { cli: 'aws', args: ['sns', 'list-topics'] },
  },
  gcp: {
    compute: { cli: 'gcloud', args: ['compute', 'instances', 'list'] },
    storage: { cli: 'gcloud', args: ['storage', 'buckets', 'list'] },
    sql: { cli: 'gcloud', args: ['sql', 'instances', 'list'] },
    functions: { cli: 'gcloud', args: ['functions', 'list'] },
    gke: { cli: 'gcloud', args: ['container', 'clusters', 'list'] },
    pubsub: { cli: 'gcloud', args: ['pubsub', 'topics', 'list'] },
    run: { cli: 'gcloud', args: ['run', 'services', 'list'] },
  },
  azure: {
    vm: { cli: 'az', args: ['vm', 'list'] },
    storage: { cli: 'az', args: ['storage', 'account', 'list'] },
    sql: { cli: 'az', args: ['sql', 'server', 'list'] },
    functions: { cli: 'az', args: ['functionapp', 'list'] },
    aks: { cli: 'az', args: ['aks', 'list'] },
    webapp: { cli: 'az', args: ['webapp', 'list'] },
    cosmosdb: { cli: 'az', args: ['cosmosdb', 'list'] },
  },
};

const MAX_OUTPUT_LENGTH = 10_000;

export const resourceListTool = createTool({
  id: 'resource_list',
  description:
    'List cloud resources by type and provider. Supports EC2, S3, RDS, Lambda (AWS), Compute, Storage, SQL (GCP), VMs, Storage (Azure), and more. Returns resource details in JSON format.',
  inputSchema: z.object({
    provider: z.enum(['aws', 'gcp', 'azure']).describe('Cloud provider'),
    resourceType: z.string().describe(
      'Resource type to list. AWS: ec2, s3, rds, documentdb, lambda, ebs, elb, ecs, eks, dynamodb, elasticache, cloudfront, sqs, sns. GCP: compute, storage, sql, functions, gke, pubsub, run. Azure: vm, storage, sql, functions, aks, webapp, cosmosdb.',
    ),
    region: z.string().optional().describe('Region to query (optional, uses CLI default if not specified)'),
  }),

  execute: async ({ provider, resourceType: rawType, region }) => {
    const resourceType = rawType.toLowerCase();

    // MOCK DATA for testing
    if (resourceType === 'documentdb') {
      return {
        content: JSON.stringify({
          DBClusters: [
            {
              DBClusterIdentifier: 'prod-docdb-cluster-1',
              Engine: 'docdb',
              EngineVersion: '5.0.0',
              Status: 'available',
              DBClusterInstanceClass: 'db.r5.large',
              StorageType: 'standard',
              AllocatedStorage: 100,
              Endpoint: 'prod-docdb-cluster-1.cluster-abc123.us-east-1.docdb.amazonaws.com',
              Port: 27017,
              DBClusterMembers: [
                { DBInstanceIdentifier: 'prod-docdb-instance-1', IsClusterWriter: true },
                { DBInstanceIdentifier: 'prod-docdb-instance-2', IsClusterWriter: false }
              ],
              AvailableMetrics: [
                'ReadIOPS',
                'WriteIOPS',
                'CPUUtilization',
                'FreeableMemory',
                'DatabaseConnections',
                'NetworkThroughput',
                'ReadLatency',
                'WriteLatency',
                'DiskQueueDepth'
              ]
            }
          ]
        }, null, 2)
      };
    }

    const providerCommands = RESOURCE_COMMANDS[provider];
    if (!providerCommands) {
      return { content: `Unknown provider: ${provider}`, isError: true };
    }

    const command = providerCommands[resourceType];
    if (!command) {
      const available = Object.keys(providerCommands).join(', ');
      return {
        content: `Unknown resource type "${resourceType}" for ${provider}. Available: ${available}`,
        isError: true,
      };
    }

    const args = [...command.args];

    // Add output format
    if (provider === 'aws') {
      args.push('--output', 'json');
      if (region) args.push('--region', region);
    } else if (provider === 'gcp') {
      args.push('--format=json');
      if (region) args.push(`--region=${region}`);
    } else if (provider === 'azure') {
      args.push('--output', 'json');
    }

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
        output = `No ${resourceType} resources found (exit code: ${exitCode})`;
      }

      if (output.length > MAX_OUTPUT_LENGTH) {
        output = output.slice(0, MAX_OUTPUT_LENGTH) + '\n...(truncated)';
      }

      return { content: output, isError: exitCode !== 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: `Failed to list resources: ${message}`, isError: true };
    }
  },
});
