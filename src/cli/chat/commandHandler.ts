import type { Agent } from '../../agent/agent';
import type { SessionStore } from '../../agent/session-store';
import { COMMAND_RESULT, COMMANDS, getAllCommandStrings, type CommandResult } from './commands';
import { CHAT_ITEM_TYPE } from '../../shared/stream/chatItems';

export interface CommandContext {
    agent: Agent;
    sessionStore?: SessionStore;
    onContinueSession?: (sessionId: string) => Promise<void>;
}

export function handleSlashCommand(command: string, context: CommandContext): CommandResult {
    const { agent } = context;

    if (getAllCommandStrings(COMMANDS.QUIT).includes(command)) {
        return COMMAND_RESULT.QUIT;
    }

    if (getAllCommandStrings(COMMANDS.HELP).includes(command)) {
        agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.HELP });
        return COMMAND_RESULT.CONTINUE;
    }

    if (getAllCommandStrings(COMMANDS.CLEAR).includes(command)) {
        agent.conversation.clear();
        agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.SUCCESS, message: 'Conversation cleared.' });
        return COMMAND_RESULT.CONTINUE;
    }

    if (getAllCommandStrings(COMMANDS.HISTORY).includes(command)) {
        const history = agent.conversation.getHistory();
        if (history.length === 0) {
            agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.INFO, message: 'No conversation history.' });
        } else {
            agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.NEWLINE });
            for (const entry of history) {
                agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.INFO, message: `  ${entry.role}: ${entry.summary}` });
            }
            agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.NEWLINE });
        }
        return COMMAND_RESULT.CONTINUE;
    }

    if (getAllCommandStrings(COMMANDS.COST).includes(command)) {
        agent.eventHandler.onItem({
            type: CHAT_ITEM_TYPE.USAGE,
            inputTokens: agent.usage.inputTokens,
            outputTokens: agent.usage.outputTokens,
        });
        return COMMAND_RESULT.CONTINUE;
    }

    if (getAllCommandStrings(COMMANDS.MODEL).includes(command)) {
        agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.NEWLINE });
        agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.INFO, message: `  Provider: ${agent.providerName}` });
        agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.INFO, message: `  Model:    ${agent.model}` });
        agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.NEWLINE });
        return COMMAND_RESULT.CONTINUE;
    }

    if (getAllCommandStrings(COMMANDS.CONTINUE).includes(command)) {
        const { sessionStore, onContinueSession } = context;
        if (!sessionStore || !onContinueSession) {
            agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.WARNING, message: 'Session persistence is not available.' });
            return COMMAND_RESULT.CONTINUE;
        }
        const sessionId = sessionStore.getMostRecentSessionId();
        if (!sessionId) {
            agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.INFO, message: 'No previous sessions found.' });
            return COMMAND_RESULT.CONTINUE;
        }
        onContinueSession(sessionId);
        return COMMAND_RESULT.CONTINUE;
    }

    if (getAllCommandStrings(COMMANDS.SESSIONS).includes(command)) {
        const { sessionStore } = context;
        if (!sessionStore) {
            agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.WARNING, message: 'Session persistence is not available.' });
            return COMMAND_RESULT.CONTINUE;
        }
        const sessions = sessionStore.listSessions(10);
        if (sessions.length === 0) {
            agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.INFO, message: 'No saved sessions.' });
            return COMMAND_RESULT.CONTINUE;
        }
        agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.NEWLINE });
        agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.INFO, message: '  Recent sessions:' });
        for (const session of sessions) {
            const date = session.updatedAt.split('T')[0] ?? session.updatedAt;
            const title = session.title || '(untitled)';
            const info = `  ${date}  ${title}  [${session.messageCount} msgs, ${session.model}]`;
            agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.INFO, message: info });
        }
        agent.eventHandler.onItem({ type: CHAT_ITEM_TYPE.NEWLINE });
        return COMMAND_RESULT.CONTINUE;
    }

    agent.eventHandler.onItem({
        type: CHAT_ITEM_TYPE.WARNING,
        message: `Unknown command: ${command}. Type ${COMMANDS.HELP.primary} for available commands.`,
    });
    return COMMAND_RESULT.CONTINUE;
}
