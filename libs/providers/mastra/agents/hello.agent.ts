import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

// smoke-test agent — proves the Mastra runtime, model router, and storage/memory wiring.
// memory has no storage of its own → inherits the Mastra instance's PostgresStore.
export const helloAgent = new Agent({
  id: 'hello',
  name: 'Hello Agent',
  instructions:
    "You are wearclair's hello agent. Greet the user warmly in one short sentence.",
  model: 'anthropic/claude-haiku-4-5',
  memory: new Memory({ options: { lastMessages: 10 } }),
});
