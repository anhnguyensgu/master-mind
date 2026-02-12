export const COMMANDS = {
    QUIT: {
        primary: '/quit',
        aliases: ['/exit', '/q'],
        description: 'Exit the agent',
    },
    HELP: {
        primary: '/help',
        aliases: ['/h'],
        description: 'Show this help',
    },
    CLEAR: {
        primary: '/clear',
        aliases: [],
        description: 'Clear conversation history',
    },
    HISTORY: {
        primary: '/history',
        aliases: [],
        description: 'Show conversation history',
    },
    COST: {
        primary: '/cost',
        aliases: ['/usage'],
        description: 'Show token usage & estimated cost',
    },
    MODEL: {
        primary: '/model',
        aliases: [],
        description: 'Show current model info',
    },
} as const;

export function getAllCommandStrings(cmd: typeof COMMANDS[keyof typeof COMMANDS]): string[] {
    return [cmd.primary, ...cmd.aliases];
}

export const COMMAND_RESULT = {
    CONTINUE: 'continue',
    QUIT: 'quit',
} as const;

export type CommandResult = typeof COMMAND_RESULT[keyof typeof COMMAND_RESULT];
