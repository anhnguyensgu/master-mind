import type { MasterMindConfig } from '../../config/config.types';

import { createAgent, type Agent } from '../../agent/agent';
import { createLLMProvider } from '../../agent/llm/llm-factory';
import { createConversationManager } from '../../agent/conversation';
import { createToolRegistry } from '../../agent/tool-registry';
import { buildSystemPrompt } from '../../agent/system-prompt';
import { createCostSummaryTool } from '../../agent/tools/cost-summary';
import { createCostByServiceTool } from '../../agent/tools/cost-by-service';
import { createCostQueryTool } from '../../agent/tools/cost-query';
import { createBashTool } from '../../agent/tools/bash';
import { createCloudCliTool } from '../../agent/tools/cloud-cli';
import { createResourceListTool } from '../../agent/tools/resource-list';
import { createResourceMetricsTool } from '../../agent/tools/resource-metrics';
import { createOptimizationTool } from '../../agent/tools/optimization';
import type { Renderer } from '../utils/renderer';
import type { Spinner } from '../utils/spinner';

export function buildAgent(config: MasterMindConfig, renderer: Renderer, spinner: Spinner): Agent {
    const provider = createLLMProvider(config.llm);
    const conversation = createConversationManager();
    const toolRegistry = createToolRegistry();

    const tools = [
        createCostSummaryTool(config.costApi),
        createCostByServiceTool(config.costApi),
        createCostQueryTool(config.costApi),
        createBashTool(),
        createCloudCliTool(),
        createResourceListTool(),
        createResourceMetricsTool(),
        createOptimizationTool(config.costApi),
    ];
    for (const tool of tools) {
        toolRegistry.register(tool);
    }

    return createAgent({
        provider,
        conversation,
        toolRegistry,
        renderer,
        spinner,
        systemPrompt: buildSystemPrompt(config, toolRegistry.list()),
        maxIterations: config.agent.maxIterations,
        streamHandler: {
            onText(chunk: string) {
                spinner.stop();
                renderer.streamText(chunk);
            },
            onToolUse(_id: string, name: string, _input: Record<string, unknown>) {
                spinner.stop();
                renderer.endStream();
                void name;
            },
            onError(error: Error) {
                spinner.stop();
                renderer.endStream();
                renderer.error(error.message);
            },
        },
    });
}


