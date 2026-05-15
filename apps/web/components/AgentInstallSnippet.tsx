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
        Anonymous queries return Tier 1 merchants, capped. Attach an Observer Protocol
        DirectoryAccessCredential to see all tiers and lift the cap.
      </p>
    </div>
  );
}
