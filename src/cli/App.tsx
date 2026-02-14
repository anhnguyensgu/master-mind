import { Box, Text, Static } from 'ink';
import type { MasterMindConfig } from '../config/config.types.ts';
import { useAgent } from './chat/hooks/useAgent.ts';
import { ChatItemView } from './chat/components/ChatItemView.tsx';
import { Spinner } from './ui/SpinnerView.tsx';
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
    statusBarInfo,
    submit,
    quit,
  } = useAgent(config);

  return (
    <Box flexDirection="column">
      <Static items={chatLog}>
        {(entry) => (
          <Box key={entry.id}>
            <ChatItemView item={entry.item} />
          </Box>
        )}
      </Static>
      <Spinner active={locked} message="Thinking..." />
      {streamText ? <Text>{streamText}</Text> : null}
      <StatusBar {...statusBarInfo} />
      <TextInput locked={locked} onSubmit={submit} onQuit={quit} />
    </Box>
  );
}
