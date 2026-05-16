export function AgentInstallSnippet() {
  return (
    <div>
      <h2>Query this from your agent</h2>
      <p className="lede">
        The directory is an MCP server. Point any MCP-compliant agent at it — Claude Desktop, Claude
        Code, Cursor, Cline, Windsurf, Codex, Gemini CLI.
      </p>
      <pre className="codeblock">
        {`# Hosted (no install) — recommended
{
  "mcpServers": {
    "at-directory": { "url": "https://mcp.agenticterminal.ai/mcp" }
  }
}

# Local
npm install -g @agenticterminal/mcp-server

# Example tool call
search_merchants({ rail: "usdt", chain: "tron", category: "gift-cards" })`}
      </pre>
      <p className="lede">
        Anonymous queries see all tiers, uncapped — no setup required. An Observer Protocol
        DirectoryAccessCredential raises rate limits and unlocks write access (reviews), but is not
        needed to discover or transact.
      </p>
    </div>
  );
}
