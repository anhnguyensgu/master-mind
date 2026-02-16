import { Box, Text } from 'ink';
import type { ChatItem } from '../../../shared/stream/chatItems';
import { CHAT_ITEM_TYPE } from '../../../shared/stream/chatItems';

type ToolItem = Extract<ChatItem, { type: 'tool_start' | 'tool_end' | 'tool_error' }>;

const MAX_RESULT_LINES = 5;

export function ToolProgress({ item }: { item: ToolItem }) {
  switch (item.type) {
    case CHAT_ITEM_TYPE.TOOL_START:
      return (
        <Text>
          {'  '}<Text color="yellow">{'\u26a1'} {item.name}</Text> <Text dimColor>{item.input}</Text>
        </Text>
      );

    case CHAT_ITEM_TYPE.TOOL_END: {
      const lines = item.result ? item.result.split('\n').slice(0, MAX_RESULT_LINES) : [];

      if (lines.length === 0) {
        return (
          <Text>
            {'  '}<Text color="green">{'\u2713'} {item.name}</Text> <Text dimColor>({item.durationMs}ms)</Text>
          </Text>
        );
      }

      return (
        <Box flexDirection="column" borderStyle="round" borderColor="green" paddingLeft={1} paddingRight={1}>
          <Text><Text color="green">{'\u2713'} {item.name}</Text> <Text dimColor>({item.durationMs}ms)</Text></Text>
          {lines.map((line, i) => (
            <Text key={i} dimColor>{line}</Text>
          ))}
        </Box>
      );
    }

    case CHAT_ITEM_TYPE.TOOL_ERROR: {
      const errorLines = item.error.split('\n').slice(0, MAX_RESULT_LINES);

      return (
        <Box flexDirection="column" borderStyle="round" borderColor="red" paddingLeft={1} paddingRight={1}>
          <Text color="red">{'\u2717'} {item.name}</Text>
          {errorLines.map((line, i) => (
            <Text key={i} color="red">{line}</Text>
          ))}
        </Box>
      );
    }
  }
}
