import { Box } from 'ink';
import type { MasterMindConfig } from '../config/config.types.ts';
import { useAgent } from './chat/hooks/useAgent.ts';
import { ScrollableOutput } from './chat/components/ScrollableOutput.tsx';
import { StatusBar } from './ui/StatusBar.tsx';
import { TextInput } from './ui/TextInput.tsx';

interface AppProps {
  config: MasterMindConfig;
}

export function App({ config }: AppProps) {
  const {
    chatLog,
    streamText,
    locked,
    activeToolName,
    statusBarInfo,
    submit,
    quit,
  } = useAgent(config);

  return (
    <Box flexDirection="column">
      <ScrollableOutput
        chatLog={chatLog}
        streamText={streamText}
        locked={locked}
        activeToolName={activeToolName}
      />
      <StatusBar {...statusBarInfo} />
      <TextInput locked={locked} onSubmit={submit} onQuit={quit} />
    </Box>
  );
}
