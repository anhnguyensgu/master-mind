import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from 'ink';
import type { MasterMindConfig } from '../../../config/config.types.ts';
import type { Agent } from '../../../agent/agent.ts';
import type { HookManager } from '../../../agent/plugins/hook-manager.ts';
import type { Spinner as SpinnerInterface } from '../../utils/spinner.ts';
import type { Renderer } from '../../utils/renderer.ts';
import type { ChatItem } from '../types/chatItems.ts';
import { CHAT_ITEM_TYPE } from '../types/chatItems.ts';
import { buildAgent } from '../agentFactory.ts';
import { handleSlashCommand } from '../commandHandler.ts';
import { createStreamParser } from './useStreamParser.ts';

import { COMMAND_RESULT } from '../commands.ts';

export interface ChatEntry {
    id: number;
    item: ChatItem;
}

export function useAgent(config: MasterMindConfig) {
    const { exit } = useApp();
    const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
    const [streamText, setStreamText] = useState('');
    const [locked, setLocked] = useState(false);
    const [spinnerActive, setSpinnerActive] = useState(false);
    const [spinnerMessage, setSpinnerMessage] = useState('Thinking...');
    const [statusBarInfo, setStatusBarInfo] = useState<{
        provider: string;
        model: string;
        inputTokens: number;
        outputTokens: number;
    }>({
        provider: config.llm.provider,
        model: config.llm.model,
        inputTokens: 0,
        outputTokens: 0,
    });

    const nextIdRef = useRef(0);
    const agentRef = useRef<Agent | null>(null);
    const hookManagerRef = useRef<HookManager | null>(null);
    const rendererRef = useRef<Renderer | null>(null);
    const parserRef = useRef<ReturnType<typeof createStreamParser> | null>(null);

    useEffect(() => {
        let id = 0;
        let cancelled = false;

        const appendItem = (item: ChatItem) => {
            const entryId = id++;
            setChatLog((prev) => [...prev, { id: entryId, item }]);
        };

        const parser = createStreamParser(appendItem);
        parserRef.current = parser;

        const renderer: Renderer = {
            banner() { appendItem({ type: CHAT_ITEM_TYPE.BANNER }); },
            help() { appendItem({ type: CHAT_ITEM_TYPE.HELP }); },
            streamText(chunk: string) {
                parser.feed(chunk);
                setStreamText(parser.getCurrentLine());
            },
            endStream() {
                setStreamText('');
                parser.flush();
            },
            toolStart(name: string, input: Record<string, unknown>) {
                const inputStr = JSON.stringify(input, null, 0);
                const truncated = inputStr.length > 100 ? inputStr.slice(0, 97) + '...' : inputStr;
                appendItem({ type: CHAT_ITEM_TYPE.TOOL_START, name, input: truncated });
            },
            toolEnd(name: string, durationMs: number) {
                appendItem({ type: CHAT_ITEM_TYPE.TOOL_END, name, durationMs });
            },
            toolError(name: string, error: string) {
                appendItem({ type: CHAT_ITEM_TYPE.TOOL_ERROR, name, error });
            },
            error(message: string) { appendItem({ type: CHAT_ITEM_TYPE.ERROR, message }); },
            info(message: string) { appendItem({ type: CHAT_ITEM_TYPE.INFO, message }); },
            warning(message: string) { appendItem({ type: CHAT_ITEM_TYPE.WARNING, message }); },
            success(message: string) { appendItem({ type: CHAT_ITEM_TYPE.SUCCESS, message }); },
            usage(usage) {
                appendItem({ type: CHAT_ITEM_TYPE.USAGE, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
            },
            divider() { appendItem({ type: CHAT_ITEM_TYPE.DIVIDER }); },
            markdown(text: string) {
                const mdParser = createStreamParser(appendItem);
                mdParser.feed(text + '\n');
                mdParser.flush();
            },
            newline() { appendItem({ type: CHAT_ITEM_TYPE.NEWLINE }); },
        };

        rendererRef.current = renderer;

        const spinner: SpinnerInterface = {
            start(message = 'Thinking...') {
                setSpinnerActive(true);
                setSpinnerMessage(message);
            },
            update(message: string) {
                setSpinnerMessage(message);
            },
            stop() {
                setSpinnerActive(false);
            },
            isActive() {
                return false;
            },
        };

        async function init() {
            try {
                const { agent, hookManager } = await buildAgent(config, renderer, spinner);
                if (cancelled) return;

                agentRef.current = agent;
                hookManagerRef.current = hookManager;
                nextIdRef.current = id;

                renderer.banner();
                renderer.info(`  Provider: ${config.llm.provider} | Model: ${config.llm.model}`);
                renderer.newline();
            } catch (error) {
                if (cancelled) return;
                const message = error instanceof Error ? error.message : String(error);
                renderer.error(`Failed to initialize agent: ${message}`);
            }
        }

        init();

        return () => {
            cancelled = true;
            hookManagerRef.current?.runOnShutdown().catch(() => {});
        };
    }, [config]);

    const submit = useCallback(async (text: string) => {
        const agent = agentRef.current;
        const renderer = rendererRef.current;
        if (!agent || !renderer) return;

        if (text.startsWith('/')) {
            const command = text.split(' ')[0]!.toLowerCase();
            const result = handleSlashCommand(command, agent, renderer);
            if (result === COMMAND_RESULT.QUIT) {
                renderer.info('Goodbye!');
                exit();
            }
            return;
        }

        renderer.info(`\u276f ${text}`);
        setLocked(true);

        await agent.handleMessage(text);

        setStatusBarInfo({
            model: agent.model,
            provider: agent.providerName,
            inputTokens: agent.usage.inputTokens,
            outputTokens: agent.usage.outputTokens,
        });

        renderer.newline();
        setLocked(false);
    }, [exit]);

    const quit = useCallback(async () => {
        await hookManagerRef.current?.runOnShutdown();
        exit();
    }, [exit]);

    return {
        chatLog,
        streamText,
        locked,
        spinnerActive,
        spinnerMessage,
        statusBarInfo,
        submit,
        quit,
    };
}
