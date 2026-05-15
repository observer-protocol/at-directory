export default function SkillPage() {
  return (
    <div>
      <h1>Agent skill</h1>
      <p className="lede">
        Install the SKILL.md so your agent knows how to query the directory, read the two trust
        axes, and complete payment handoff per rail.
      </p>

      <h2>Install</h2>
      <pre className="codeblock">
        {`# Claude
mkdir -p ~/.claude/skills/agentic-terminal
curl -fsSL https://agenticterminal.ai/SKILL.md \\
  -o ~/.claude/skills/agentic-terminal/SKILL.md`}
      </pre>

      <h2>Add the MCP server</h2>
      <pre className="codeblock">
        {`# Hosted (recommended)
{ "mcpServers": { "at-directory": { "url": "https://mcp.agenticterminal.ai/mcp" } } }

# Local
npm install -g @agenticterminal/mcp-server`}
      </pre>

      <h2>The two axes, restated</h2>
      <p>
        OP trust tier describes the <em>merchant</em>. Agent-callable tier describes the{' '}
        <em>integration</em>. They are independent — always read both before transacting.
      </p>

      <p className="notice">
        Full skill text:{' '}
        <a href="https://agenticterminal.ai/SKILL.md">agenticterminal.ai/SKILL.md</a> (served from
        the repo&apos;s packages/skill/SKILL.md).
      </p>
    </div>
  );
}
