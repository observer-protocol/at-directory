import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { ANONYMOUS_IDENTITY } from './auth.ts';
import { buildServer } from './server.ts';

const data = {
  merchants: [],
  categoryLabels: { marketplace: 'Marketplace' },
  railsManifest: { rails: [{ id: 'lightning' as const, label: 'Lightning Network' }] },
};

async function connected() {
  const server = buildServer(data, { identity: ANONYMOUS_IDENTITY, credential: null });
  const client = new Client({ name: 'mcp-contract-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

describe('MCP contracts', () => {
  it('publishes titles for every tool and strict schemas only for modeled outputs', async () => {
    const { client, server } = await connected();
    try {
      const listed = await client.listTools();
      expect(listed.tools).toHaveLength(6);
      expect(listed.tools.every((tool) => typeof tool.title === 'string')).toBe(true);
      expect(
        listed.tools
          .filter((tool) => tool.outputSchema)
          .map((tool) => tool.name)
          .sort(),
      ).toEqual(['list_categories', 'list_rails', 'whoami']);
      for (const tool of listed.tools.filter((entry) => entry.outputSchema)) {
        expect(tool.outputSchema?.type).toBe('object');
        expect(tool.outputSchema?.additionalProperties).toBe(false);
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  it('returns schema-valid structured content alongside the text result', async () => {
    const { client, server } = await connected();
    try {
      const result = await client.callTool({ name: 'whoami', arguments: {} });
      expect(result.structuredContent).toEqual({
        authenticated: false,
        tier_cap: 'anonymous',
        limits: { result_cap: 100, requests_per_minute: 30 },
      });
      const content = result.content as Array<{ type: string; text?: string }>;
      expect(JSON.parse(content[0]?.text ?? '')).toEqual(result.structuredContent);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
