import type { Agent } from '../../agent/agent';
import { COMMAND_RESULT, COMMANDS, getAllCommandStrings, type CommandResult } from './commands';
import type { Renderer } from '../utils/renderer';

export function handleSlashCommand(command: string, agent: Agent, renderer: Renderer): CommandResult {
    if (getAllCommandStrings(COMMANDS.QUIT).includes(command)) {
        return COMMAND_RESULT.QUIT;
    }

    if (getAllCommandStrings(COMMANDS.HELP).includes(command)) {
        renderer.help();
        return COMMAND_RESULT.CONTINUE;
    }

    if (getAllCommandStrings(COMMANDS.CLEAR).includes(command)) {
        agent.conversation.clear();
        renderer.success('Conversation cleared.');
        return COMMAND_RESULT.CONTINUE;
    }

    if (getAllCommandStrings(COMMANDS.HISTORY).includes(command)) {
        const history = agent.conversation.getHistory();
        if (history.length === 0) {
            renderer.info('No conversation history.');
        } else {
            renderer.newline();
            for (const entry of history) {
                renderer.info(`  ${entry.role}: ${entry.summary}`);
            }
            renderer.newline();
        }
        return COMMAND_RESULT.CONTINUE;
    }

    if (getAllCommandStrings(COMMANDS.COST).includes(command)) {
        renderer.usage(agent.usage);
        return COMMAND_RESULT.CONTINUE;
    }

    if (getAllCommandStrings(COMMANDS.MODEL).includes(command)) {
        renderer.newline();
        renderer.info(`  Provider: ${agent.providerName}`);
        renderer.info(`  Model:    ${agent.model}`);
        renderer.newline();
        return COMMAND_RESULT.CONTINUE;
    }

    renderer.warning(`Unknown command: ${command}. Type ${COMMANDS.HELP.primary} for available commands.`);
    return COMMAND_RESULT.CONTINUE;
}
