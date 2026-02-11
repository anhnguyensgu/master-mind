import type {
  LLMProvider,
  LLMMessage,
  LLMToolDef,
  LLMResponse,
  LLMContentBlock,
  StreamCallbacks,
} from './llm.types';
import type { TokenUsage } from '../agent.types';

const DELAY_MS = 30; // simulate streaming delay per chunk

const RESPONSES: Record<string, string> = {
  cost: `Based on the data, here's your **cloud cost summary**:

| Service | Monthly Cost |
|---------|-------------|
| EC2     | $1,245.00   |
| RDS     | $890.50     |
| S3      | $234.20     |
| Lambda  | $45.80      |

**Total**: $2,415.50/month

## Recommendations
1. **Rightsize EC2** — 3 instances running at <15% CPU utilization
2. **Reserved Instances** — switching to 1-year RI for stable workloads saves ~40%
3. **S3 Lifecycle** — move infrequently accessed data to S3 IA (est. savings: $80/month)`,

  optimize: `## Optimization Analysis

I found **3 quick wins** that could save ~**$680/month**:

1. **Idle EC2 instances** — \`i-0a1b2c3d\` and \`i-0e4f5g6h\` have <5% CPU for 30 days. Consider stopping or downsizing.
2. **Unattached EBS volumes** — 4 volumes (280 GB total) with no attached instance. Safe to snapshot and delete.
3. **Over-provisioned RDS** — \`db-prod-main\` is \`db.r5.2xlarge\` but uses <20% resources. Downgrade to \`db.r5.xlarge\`.`,

  default: `I'm Master Mind, your cloud cost optimization assistant. I can help you with:

- **Cost analysis** — break down spending by service, region, or tag
- **Resource inspection** — list and describe your cloud resources
- **Utilization metrics** — check CPU, memory, network usage
- **Optimization** — find savings opportunities and unused resources
- **Shell commands** — run read-only commands to investigate

What would you like to explore?`,
};

function pickResponse(messages: LLMMessage[]): string {
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg) return RESPONSES.default;

  const text = typeof lastMsg.content === 'string'
    ? lastMsg.content.toLowerCase()
    : '';

  if (text.includes('cost') || text.includes('spend') || text.includes('bill')) {
    return RESPONSES.cost;
  }
  if (text.includes('optim') || text.includes('sav') || text.includes('reduc')) {
    return RESPONSES.optimize;
  }
  return RESPONSES.default;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockProvider implements LLMProvider {
  readonly name = 'mock';
  readonly model = 'mock-1.0';
  private totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

  async streamMessage(
    messages: LLMMessage[],
    _systemPrompt: string,
    _tools: LLMToolDef[],
    callbacks: StreamCallbacks,
  ): Promise<LLMResponse> {
    const responseText = pickResponse(messages);

    // Simulate streaming word by word
    const words = responseText.split(' ');
    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? '' : ' ') + words[i];
      callbacks.onText(chunk);
      await sleep(DELAY_MS);
    }

    const inputTokens = Math.floor(Math.random() * 200) + 100;
    const outputTokens = Math.floor(responseText.length / 4);
    this.totalUsage.inputTokens += inputTokens;
    this.totalUsage.outputTokens += outputTokens;

    const content: LLMContentBlock[] = [{ type: 'text', text: responseText }];

    return {
      content,
      stopReason: 'end',
      usage: { inputTokens, outputTokens },
    };
  }

  getUsage(): TokenUsage {
    return { ...this.totalUsage };
  }
}
