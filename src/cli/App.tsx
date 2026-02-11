import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, Static, useApp } from 'ink';
import type { MasterMindConfig } from '../config/config.types.ts';
import type { Agent } from '../agent/agent.ts';
import type { Spinner as SpinnerInterface } from './spinner.ts';
import { buildAgent, handleSlashCommand } from './cli.ts';
import { createTuiRenderer } from './tuiRenderer.ts';
import { Spinner } from './SpinnerView.tsx';
import { StatusBar } from './StatusBar.tsx';
import { TextInput } from './TextInput.tsx';
import { theme, colors } from './theme.ts';

interface ChatLine {
  id: number;
  text: string;
}

interface AppProps {
  config: MasterMindConfig;
}

export function App({ config }: AppProps) {
  const { exit } = useApp();
  const [chatLog, setChatLog] = useState<ChatLine[]>([]);
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
  const rendererRef = useRef<ReturnType<typeof createTuiRenderer> | null>(null);

  // Initialize agent on mount
  useEffect(() => {
    let id = 0;
    const appendLine = (text: string) => {
      const lineId = id++;
      setChatLog((prev) => [...prev, { id: lineId, text }]);
    };
    const renderer = createTuiRenderer({ appendLine, setStreamText });
    rendererRef.current = renderer;

    // Spinner adapter that sets React state
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
        return false; // stateless check — React state is source of truth
      },
    };

    try {
      const agent = buildAgent(config, renderer, spinner);
      agentRef.current = agent;
      nextIdRef.current = id;

      renderer.banner();
      renderer.info(`  Provider: ${config.llm.provider} | Model: ${config.llm.model}`);
      renderer.newline();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      renderer.error(`Failed to initialize agent: ${message}`);
    }
  }, [config]);

  const handleSubmit = useCallback(async (text: string) => {
    const agent = agentRef.current;
    const renderer = rendererRef.current;
    if (!agent || !renderer) return;

    // Check for slash commands
    if (text.startsWith('/')) {
      const command = text.split(' ')[0]!.toLowerCase();
      const result = handleSlashCommand(command, agent, renderer);
      if (result === 'quit') {
        renderer.info('Goodbye!');
        exit();
      }
      return;
    }

    // User message
    renderer.info(`${theme.prompt}❯${colors.reset} ${text}`);
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

  const handleQuit = useCallback(() => {
    exit();
  }, [exit]);

  return (
    <Box flexDirection="column">
      <Static items={chatLog}>
        {(item) => <Text key={item.id}>{item.text}</Text>}
      </Static>
      <Spinner active={spinnerActive} message={spinnerMessage} />
      {streamText ? <Text>{streamText}</Text> : null}
      <StatusBar {...statusBarInfo} />
      <TextInput locked={locked} onSubmit={handleSubmit} onQuit={handleQuit} />
    </Box>
  );
}
