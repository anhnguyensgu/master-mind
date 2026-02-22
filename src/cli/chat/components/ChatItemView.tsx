import { Box, Text } from 'ink';
import type { ChatItem } from '../../../shared/stream/chatItems';
import { CHAT_ITEM_TYPE } from '../../../shared/stream/chatItems';
import { COMMANDS } from '../commands.ts';
import { InlineText } from '../../ui/InlineText.tsx';
import { ToolProgress } from './ToolProgress.tsx';

export function ChatItemView({ item }: { item: ChatItem }) {
  switch (item.type) {
    case CHAT_ITEM_TYPE.TEXT:
      return <InlineText text={item.text} />;

    case CHAT_ITEM_TYPE.HEADING:
      if (item.level === 1)
        return <Text bold underline color="cyan">{'\n'}{item.text}</Text>;
      if (item.level === 2)
        return <Text bold color="cyan">{'\n'}  {item.text}</Text>;
      return <Text bold color="magenta">   {item.text}</Text>;

    case CHAT_ITEM_TYPE.CODE: {
      const width = 60;
      const langLabel = item.lang ? ` ${item.lang} ` : '';
      const topRule = `\u250c${langLabel}${'\u2500'.repeat(Math.max(0, width - langLabel.length - 2))}\u2510`;
      const bottomRule = `\u2514${'\u2500'.repeat(width - 2)}\u2518`;
      return (
        <Box flexDirection="column">
          <Text dimColor>{topRule}</Text>
          {item.lines.map((line, i) => (
            <Text key={i}><Text dimColor>{'\u2502'}</Text> <Text color="green">{line}</Text></Text>
          ))}
          <Text dimColor>{bottomRule}</Text>
        </Box>
      );
    }

    case CHAT_ITEM_TYPE.TABLE: {
      const { headers, rows, colWidths } = item;
      const pad = (text: string, w: number) => text + ' '.repeat(Math.max(0, w - text.length));
      const top = `\u250c${colWidths.map(w => '\u2500'.repeat(w + 2)).join('\u252c')}\u2510`;
      const sep = `\u251c${colWidths.map(w => '\u2500'.repeat(w + 2)).join('\u253c')}\u2524`;
      const bottom = `\u2514${colWidths.map(w => '\u2500'.repeat(w + 2)).join('\u2534')}\u2518`;

      return (
        <Box flexDirection="column">
          <Text dimColor>{top}</Text>
          <Text>
            <Text dimColor>{'\u2502'}</Text>
            {headers.map((h, i) => (
              <Text key={i}> <Text bold>{pad(h, colWidths[i]!)}</Text> <Text dimColor>{'\u2502'}</Text></Text>
            ))}
          </Text>
          <Text dimColor>{sep}</Text>
          {rows.map((row, ri) => (
            <Text key={ri}>
              <Text dimColor>{'\u2502'}</Text>
              {row.map((cell, ci) => (
                <Text key={ci}> {pad(cell, colWidths[ci]!)} <Text dimColor>{'\u2502'}</Text></Text>
              ))}
            </Text>
          ))}
          <Text dimColor>{bottom}</Text>
        </Box>
      );
    }

    case CHAT_ITEM_TYPE.LIST_ITEM:
      if (item.ordered) {
        return <Text>  <Text dimColor>{item.index ?? 1}.</Text> <InlineText text={item.text} /></Text>;
      }
      return <Text>  <Text dimColor>{'\u2022'}</Text> <InlineText text={item.text} /></Text>;

    case CHAT_ITEM_TYPE.DIVIDER:
      return <Text dimColor>{'\u2500'.repeat(60)}</Text>;

    case CHAT_ITEM_TYPE.NEWLINE:
      return <Text>{' '}</Text>;

    case CHAT_ITEM_TYPE.TOOL_START:
    case CHAT_ITEM_TYPE.TOOL_END:
    case CHAT_ITEM_TYPE.TOOL_ERROR:
      return <ToolProgress item={item} />;

    case CHAT_ITEM_TYPE.ERROR:
      return <Text color="red">Error: {item.message}</Text>;

    case CHAT_ITEM_TYPE.INFO:
      return <Text color="blue">{item.message}</Text>;

    case CHAT_ITEM_TYPE.WARNING:
      return <Text color="yellow">{item.message}</Text>;

    case CHAT_ITEM_TYPE.SUCCESS:
      return <Text color="green">{item.message}</Text>;

    case CHAT_ITEM_TYPE.USAGE:
      return (
        <Box flexDirection="column">
          <Text>{' '}</Text>
          <Text bold color="cyan">Token Usage:</Text>
          <Text>  Input:  <Text color="cyan">{item.inputTokens.toLocaleString()}</Text></Text>
          <Text>  Output: <Text color="cyan">{item.outputTokens.toLocaleString()}</Text></Text>
          <Text>  Total:  <Text color="cyan">{(item.inputTokens + item.outputTokens).toLocaleString()}</Text></Text>
          <Text>{' '}</Text>
        </Box>
      );

    case CHAT_ITEM_TYPE.BANNER:
      return (
        <Box flexDirection="column">
          <Text>{' '}</Text>
          <Text color="cyan">{'    \u2597\u2584\u2588\u2588\u2584\u2596'}</Text>
          <Text color="cyan">{'   \u2590\u2588\u2580  \u2580\u2588\u258c'}</Text>
          <Text color="cyan">{'   \u2590\u2588\u2584  \u2584\u2588\u258c'}</Text>
          <Text color="cyan">{'    \u259d\u2580\u2588\u2588\u2580\u2598'}</Text>
          <Text>{' '}</Text>
          <Text><Text bold color="cyan">  Master Mind</Text> <Text dimColor>— Cloud Cost Optimization Agent</Text></Text>
          <Text dimColor>  Type <Text color="white">/help</Text><Text dimColor> for commands, </Text><Text color="white">/quit</Text><Text dimColor> to exit</Text></Text>
          <Text>{' '}</Text>
        </Box>
      );

    case CHAT_ITEM_TYPE.HELP:
      return (
        <Box flexDirection="column">
          <Text>{' '}</Text>
          <Text bold color="cyan">Commands:</Text>
          {Object.values(COMMANDS).map((cmd) => (
            <Text key={cmd.primary}>  <Text color="cyan">{cmd.primary}</Text>     {cmd.description}</Text>
          ))}
          <Text>{' '}</Text>
          <Text bold color="cyan">Tips:</Text>
          <Text dimColor>  End a line with \ for multiline input</Text>
          <Text dimColor>  Ask about cloud costs, resource utilization, or optimization</Text>
          <Text>{' '}</Text>
        </Box>
      );
  }
}
