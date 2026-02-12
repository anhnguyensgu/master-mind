import { Box, Text } from 'ink';
import type { ChatItem } from './chatItems.ts';
import { InlineText } from './InlineText.tsx';

export function ChatItemView({ item }: { item: ChatItem }) {
  switch (item.type) {
    case 'text':
      return <InlineText text={item.text} />;

    case 'heading':
      if (item.level === 1)
        return <Text bold underline color="cyan">{'\n'}{item.text}</Text>;
      if (item.level === 2)
        return <Text bold color="cyan">{'\n'}  {item.text}</Text>;
      return <Text bold color="magenta">   {item.text}</Text>;

    case 'code': {
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

    case 'table': {
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

    case 'list_item':
      if (item.ordered) {
        return <Text>  <Text dimColor>{item.index ?? 1}.</Text> <InlineText text={item.text} /></Text>;
      }
      return <Text>  <Text dimColor>{'\u2022'}</Text> <InlineText text={item.text} /></Text>;

    case 'divider':
      return <Text dimColor>{'\u2500'.repeat(60)}</Text>;

    case 'newline':
      return <Text>{' '}</Text>;

    case 'tool_start':
      return <Text>  <Text color="yellow">{'\u26a1'} {item.name}</Text> <Text dimColor>{item.input}</Text></Text>;

    case 'tool_end':
      return <Text>  <Text color="green">{'\u2713'} {item.name}</Text> <Text dimColor>({item.durationMs}ms)</Text></Text>;

    case 'tool_error':
      return <Text>  <Text color="red">{'\u2717'} {item.name}</Text>: {item.error}</Text>;

    case 'error':
      return <Text color="red">Error: {item.message}</Text>;

    case 'info':
      return <Text color="blue">{item.message}</Text>;

    case 'warning':
      return <Text color="yellow">{item.message}</Text>;

    case 'success':
      return <Text color="green">{item.message}</Text>;

    case 'usage':
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

    case 'banner':
      return (
        <Box flexDirection="column">
          <Text>{' '}</Text>
          <Text color="cyan">          </Text>
          <Text color="cyan">  {'\u2590\u259b\u2588\u2588\u2588\u259c\u258c'} </Text>
          <Text color="cyan"> {'\u259d\u259c\u2588\u2588\u2588\u2588\u2588\u259b\u2598'}</Text>
          <Text color="cyan">   {'\u2598\u2598'} {'\u259d\u259d'}  </Text>
          <Text>{' '}</Text>
          <Text><Text bold color="cyan">  Master Mind</Text> <Text dimColor>— Cloud Cost Optimization Agent</Text></Text>
          <Text dimColor>  Type <Text color="white">/help</Text><Text dimColor> for commands, </Text><Text color="white">/quit</Text><Text dimColor> to exit</Text></Text>
          <Text>{' '}</Text>
        </Box>
      );

    case 'help':
      return (
        <Box flexDirection="column">
          <Text>{' '}</Text>
          <Text bold color="cyan">Commands:</Text>
          <Text>  <Text color="cyan">/help</Text>     Show this help</Text>
          <Text>  <Text color="cyan">/quit</Text>     Exit the agent</Text>
          <Text>  <Text color="cyan">/clear</Text>    Clear conversation history</Text>
          <Text>  <Text color="cyan">/history</Text>  Show conversation history</Text>
          <Text>  <Text color="cyan">/cost</Text>     Show token usage &amp; estimated cost</Text>
          <Text>  <Text color="cyan">/model</Text>    Show current model info</Text>
          <Text>{' '}</Text>
          <Text bold color="cyan">Tips:</Text>
          <Text dimColor>  End a line with \ for multiline input</Text>
          <Text dimColor>  Ask about cloud costs, resource utilization, or optimization</Text>
          <Text>{' '}</Text>
        </Box>
      );
  }
}
