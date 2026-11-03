/**
 * Smoke test for the MCP server: connects like Claude would, lists the tools,
 * reads the causes, gives $0.12 to clean water over x402 and follows the gift.
 *
 *   AGENT_KEYPAIR_PATH=~/.config/solana/devnet.json npx tsx scripts/mcp-smoke.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

async function main() {
  const transport = new StdioClientTransport({ command: 'npx', args: ['tsx', 'mcp/server.ts'], env: { ...process.env } as Record<string, string> })
  const client = new Client({ name: 'umanity-smoke', version: '1.0.0' })
  await client.connect(transport)
  const tools = await client.listTools()
  console.log('tools:', tools.tools.map((t) => t.name).join(', '))
  const show = (r: unknown) => console.log(((r as { content: { text: string }[] }).content ?? []).map((c) => c.text).join('\n'), '\n')
  show(await client.callTool({ name: 'list_causes', arguments: {} }))
  const gift = await client.callTool({ name: 'give', arguments: { causeId: 'clean-water', amountUsd: 0.12, note: 'mcp-smoke-test' } })
  show(gift)
  const track = ((gift as { content: { text: string }[] }).content[0]?.text.match(/Follow it: (\S+)/) ?? [])[1]
  if (track) show(await client.callTool({ name: 'follow_gift', arguments: { ref: track } }))
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
