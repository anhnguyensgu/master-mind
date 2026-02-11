import { Text } from 'ink';

interface StatusBarProps {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  streaming?: boolean;
}

export function StatusBar({ provider, model, inputTokens, outputTokens, streaming }: StatusBarProps) {
  const tokens = `${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out`;
  const streamingLabel = streaming ? '  [streaming]' : '';
  const content = ` ${provider} | ${model} | Tokens: ${tokens}${streamingLabel}`;

  return <Text inverse>{content}</Text>;
}
