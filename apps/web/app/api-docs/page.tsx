interface Tool {
  name: string;
  summary: string;
  args: string;
  returns: string;
}

const TOOLS: Tool[] = [
  {
    name: 'search_merchants',
    summary:
      'Search merchants by rail, chain, category, agent-callable tier, trust tier, USDC, and free text. Ranked by trust tier then verification recency. Reads are ungated: anonymous and credentialed callers see all tiers, same limits.',
    args: 'query?, rail?, chain?, category?, agent_callable_tier?, trust_tier_min?, accepts_usdc?, limit?',
    returns: '{ results: MerchantSummary[], total_matching, truncated, agent_identity }',
  },
  {
    name: 'get_merchant',
    summary:
      'Full record for one merchant including all rails, payment endpoints, and OP attestation. Tier 2+ requires an AT credential.',
    args: 'id: string',
    returns: '{ merchant: Merchant, agent_identity } | { error }',
  },
  {
    name: 'verify_payment_endpoint',
    summary:
      "Live check against a merchant's declared payment endpoint for a rail. Returns health, detail, and rail-specific evidence.",
    args: 'merchant_id: string, rail: lightning|bolt12|l402|usdt',
    returns: '{ merchant_id, rail, status, detail, checked_at, evidence, agent_identity }',
  },
  {
    name: 'list_categories',
    summary: 'The category taxonomy with merchant counts.',
    args: '(none)',
    returns: '{ categories: { id, label, merchant_count }[] }',
  },
  {
    name: 'list_rails',
    summary: 'Supported rails and their merchant counts, with USDT chain breakdown.',
    args: '(none)',
    returns: '{ rails: { rail, label, merchant_count, chains? }[] }',
  },
  {
    name: 'whoami',
    summary: 'Resolved credential state and rate limits for the calling agent.',
    args: '(none)',
    returns: '{ authenticated, tier_cap, limits, credential? }',
  },
];

export default function ApiDocsPage() {
  return (
    <div>
      <h1>MCP tool surface</h1>
      <p className="lede">
        The directory is an MCP server. Six tools. Structured JSON, agent-optimized, flat where
        possible. Every response echoes <code>agent_identity</code> so the agent can reason about
        anonymous vs. credentialed state.
      </p>

      {TOOLS.map((t) => (
        <div key={t.name} style={{ margin: '20px 0' }}>
          <h2 style={{ margin: '0 0 6px' }}>
            <code>{t.name}</code>
          </h2>
          <p style={{ margin: '0 0 8px' }}>{t.summary}</p>
          <pre className="codeblock">{`args:    ${t.args}\nreturns: ${t.returns}`}</pre>
        </div>
      ))}

      <h2>Authentication</h2>
      <p>
        Discovery and transaction need <strong>no credential</strong> — reads are ungated. Present
        an Observer Protocol <code>DirectoryAccessCredential</code> to raise rate limits and unlock
        write access (reviews). Hosted: <code>X-AT-Credential</code> header (base64url JSON). Local
        stdio: <code>AT_CREDENTIAL</code> env var. Anonymous when absent.
      </p>

      <h2>Error codes</h2>
      <pre className="codeblock">
        {`credential_required        Tier 2+ record requested without auth
credential_invalid         Presented credential failed verification
rate_limited               Caller exceeded their bucket
unknown_merchant           id did not resolve
unsupported_rail           rail not present on this merchant
verification_unavailable   downstream verification dependency failed`}
      </pre>
    </div>
  );
}
