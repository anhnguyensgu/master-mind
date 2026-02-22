import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from 'ink';
import type { MasterMindConfig } from '../../../config/config.types.ts';
import { Agent, type AgentEventHandler } from '../../../agent/agent.ts';
import type { HookManager } from '../../../agent/plugins/hook-manager.ts';
import type { ChatItem } from '../../../shared/stream/chatItems';
import { CHAT_ITEM_TYPE } from '../../../shared/stream/chatItems';
import { buildAgent } from '../agentFactory.ts';
import { handleSlashCommand } from '../commandHandler.ts';
import { COMMAND_RESULT } from '../commands.ts';
import { createSessionStore, type SessionStore } from '../../../agent/session-store.ts';

export interface ChatEntry {
    id: number;
    item: ChatItem;
}

export function useAgent(config: MasterMindConfig) {
    const { exit } = useApp();
    const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
    const [streamText, setStreamText] = useState('');
    const [locked, setLocked] = useState(false);
    const [activeToolName, setActiveToolName] = useState<string | null>(null);
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
    const sessionStoreRef = useRef<SessionStore | null>(null);

    useEffect(() => {
        let id = 0;
        let cancelled = false;

        const appendItem = (item: ChatItem) => {
            const entryId = id++;
            setChatLog((prev) => [...prev, { id: entryId, item }]);
        };

        const eventHandler: AgentEventHandler = {
            onItem(item: ChatItem) {
                if (item.type === CHAT_ITEM_TYPE.TOOL_START) {
                    setActiveToolName(item.name);
                } else if (item.type === CHAT_ITEM_TYPE.TOOL_END || item.type === CHAT_ITEM_TYPE.TOOL_ERROR) {
                    setActiveToolName(null);
                }
                appendItem(item);
            },
            onStreamDelta(text: string) {
                setStreamText(text);
            },
        };

        async function init() {
            try {
                let sessionStore: SessionStore | undefined;
                try {
                    sessionStore = createSessionStore();
                    sessionStoreRef.current = sessionStore;
                } catch {
                    appendItem({ type: CHAT_ITEM_TYPE.WARNING, message: 'Could not initialize session storage. Conversations will not be saved.' });
                }

                const { agent, hookManager } = await buildAgent({ config, eventHandler, sessionStore });
                if (cancelled) return;

                agentRef.current = agent;
                hookManagerRef.current = hookManager;
                nextIdRef.current = id;

                appendItem({ type: CHAT_ITEM_TYPE.BANNER });
                appendItem({ type: CHAT_ITEM_TYPE.INFO, message: `  Provider: ${config.llm.provider} | Model: ${config.llm.model}` });
                appendItem({ type: CHAT_ITEM_TYPE.NEWLINE });
            } catch (error) {
                if (cancelled) return;
                const message = error instanceof Error ? error.message : String(error);
                appendItem({ type: CHAT_ITEM_TYPE.ERROR, message: `Failed to initialize agent: ${message}` });
            }
        }

        init();

        return () => {
            cancelled = true;
            hookManagerRef.current?.runOnShutdown().catch(() => {});
            sessionStoreRef.current?.close();
            sessionStoreRef.current = null;
        };
    }, [config]);

    const continueSession = useCallback(async (sessionId: string) => {
        const sessionStore = sessionStoreRef.current;
        if (!sessionStore) return;

        const appendItem = (item: ChatItem) => {
            const entryId = nextIdRef.current++;
            setChatLog((prev) => [...prev, { id: entryId, item }]);
        };

        const eventHandler: AgentEventHandler = {
            onItem(item: ChatItem) {
                if (item.type === CHAT_ITEM_TYPE.TOOL_START) {
                    setActiveToolName(item.name);
                } else if (item.type === CHAT_ITEM_TYPE.TOOL_END || item.type === CHAT_ITEM_TYPE.TOOL_ERROR) {
                    setActiveToolName(null);
                }
                appendItem(item);
            },
            onStreamDelta(text: string) {
                setStreamText(text);
            },
        };

        try {
            const { agent, hookManager } = await buildAgent({
                config,
                eventHandler,
                sessionStore,
                resumeSessionId: sessionId,
            });

            agentRef.current = agent;
            hookManagerRef.current = hookManager;

            const messageCount = agent.conversation.messageCount();
            appendItem({ type: CHAT_ITEM_TYPE.SUCCESS, message: `Resumed session (${messageCount} messages loaded).` });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            appendItem({ type: CHAT_ITEM_TYPE.ERROR, message: `Failed to resume session: ${message}` });
        }
    }, [config]);

    const submit = useCallback(async (text: string) => {
        const agent = agentRef.current;
        if (!agent) return;

        if (text.startsWith('/')) {
            const command = text.split(' ')[0]!.toLowerCase();
            const result = handleSlashCommand(command, {
                agent,
                sessionStore: sessionStoreRef.current ?? undefined,
                onContinueSession: continueSession,
            });
            if (result === COMMAND_RESULT.QUIT) {
                agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.INFO, message: 'Goodbye!' });
                exit();
            }
            return;
        }

        agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.INFO, message: `\u276f ${text}` });
        setLocked(true);

        await agent.handleMessage(text);

        setStatusBarInfo({
            model: agent.model,
            provider: agent.providerName,
            inputTokens: agent.usage.inputTokens,
            outputTokens: agent.usage.outputTokens,
        });

        agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.NEWLINE });
        setLocked(false);
    }, [exit, continueSession]);

    const quit = useCallback(async () => {
        await hookManagerRef.current?.runOnShutdown();
        sessionStoreRef.current?.close();
        sessionStoreRef.current = null;
        exit();
    }, [exit]);

    return {
        chatLog,
        streamText,
        locked,
        activeToolName,
        statusBarInfo,
        submit,
        quit,
    };
}
