import type { MasterMindConfig } from '../../config/config.types';
import type { AgentTool } from '../agent.types';
import { createCostSummaryTool } from './cost-summary';
import { createCostByServiceTool } from './cost-by-service';
import { createCostQueryTool } from './cost-query';
import { createBashTool } from './bash';
import { createCloudCliTool } from './cloud-cli';
import { createResourceListTool } from './resource-list';
import { createResourceMetricsTool } from './resource-metrics';
import { createOptimizationTool } from './optimization';

export function createBuiltInTools(config: MasterMindConfig): AgentTool[] {
  return [
    createCostSummaryTool(config.costApi),
    createCostByServiceTool(config.costApi),
    createCostQueryTool(config.costApi),
    createBashTool(),
    createCloudCliTool(),
    createResourceListTool(),
    createResourceMetricsTool(),
    createOptimizationTool(config.costApi),
  ];
}
