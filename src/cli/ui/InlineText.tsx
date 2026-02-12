import { Text } from 'ink';

interface Segment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

function parseInline(input: string): Segment[] {
  const segments: Segment[] = [];
  // Match: `code`, **bold**, *italic*, or plain text
  const regex = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|([^`*]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match[1] !== undefined) {
      segments.push({ text: match[1], code: true });
    } else if (match[2] !== undefined) {
      segments.push({ text: match[2], bold: true });
    } else if (match[3] !== undefined) {
      segments.push({ text: match[3], italic: true });
    } else if (match[4] !== undefined) {
      segments.push({ text: match[4] });
    }
  }

  return segments;
}

export function InlineText({ text }: { text: string }) {
  const segments = parseInline(text);

  if (segments.length === 0) return <Text>{text}</Text>;
  if (segments.length === 1) {
    const s = segments[0]!;
    if (s.code) return <Text color="green" bold>{s.text}</Text>;
    if (s.bold) return <Text bold>{s.text}</Text>;
    if (s.italic) return <Text italic>{s.text}</Text>;
    return <Text>{s.text}</Text>;
  }

  return (
    <Text>
      {segments.map((s, i) => {
        if (s.code) return <Text key={i} color="green" bold>{s.text}</Text>;
        if (s.bold) return <Text key={i} bold>{s.text}</Text>;
        if (s.italic) return <Text key={i} italic>{s.text}</Text>;
        return <Text key={i}>{s.text}</Text>;
      })}
    </Text>
  );
}
