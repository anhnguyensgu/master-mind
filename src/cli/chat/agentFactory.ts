import type { MasterMindConfig } from '../../config/config.types';

import { createAgent, type Agent } from '../../agent/agent';
import { createLLMProvider } from '../../agent/llm/llm-factory';
import { createConversationManager } from '../../agent/conversation';
import { createToolRegistry } from '../../agent/tool-registry';
import { buildSystemPrompt } from '../../agent/system-prompt';
import { createBuiltInTools } from '../../agent/tools/built-in-tools';
import { createHookManager, type HookManager } from '../../agent/plugins/hook-manager';
import { loadPlugins } from '../../agent/plugins/plugin-loader';
import type { Renderer } from '../utils/renderer';
import type { Spinner } from '../utils/spinner';

export async function buildAgent(
    config: MasterMindConfig,
    renderer: Renderer,
    spinner: Spinner,
): Promise<{ agent: Agent; hookManager: HookManager }> {
    const provider = createLLMProvider(config.llm);
    const conversation = createConversationManager();
    const hookManager = createHookManager();
    const toolRegistry = createToolRegistry(hookManager);

    for (const tool of createBuiltInTools(config)) {
        toolRegistry.register(tool);
    }

    await loadPlugins(config, toolRegistry, hookManager);

    const agent = createAgent({
        provider,
        conversation,
        toolRegistry,
        renderer,
        spinner,
        systemPrompt: buildSystemPrompt(config, toolRegistry.list()),
        maxIterations: config.agent.maxIterations,
        hookManager,
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

    return { agent, hookManager };
}
