import { notFound } from 'next/navigation';
import { allMerchants, merchantBySlug, categoryLabel } from '@/lib/data';
import { TrustBadge } from '@/components/TrustBadge';
import { RailIcon } from '@/components/RailIcon';
import { VerifyNowButton } from '@/components/VerifyNowButton';

export function generateStaticParams() {
  return allMerchants().map((m) => ({ slug: m.id }));
}

export default async function MerchantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = merchantBySlug(slug);
  if (!m) notFound();

  return (
    <div>
      <h1>{m.name}</h1>
      <p className="lede">{m.description}</p>
      <div className="row">
        <TrustBadge tier={m.op_trust_tier} attestationUrl={m.op_attestation_url} />
        <span className="badge callable">{m.agent_callable_tier}</span>
        <span className="badge">{m.pricing_model}</span>
        {m.accepts_usdc && <span className="badge">+ USDC</span>}
        {m.accepts_x402 && <span className="badge">+ x402</span>}
      </div>

      <p>
        <a href={m.url} target="_blank" rel="noreferrer">
          {m.url}
        </a>{' '}
        · <a href={`/categories/${m.category}/`}>{categoryLabel(m.category)}</a>
      </p>

      <h2>Rails</h2>
      <table>
        <thead>
          <tr>
            <th>Rail</th>
            <th>Chain</th>
            <th>Health</th>
            <th>Verify</th>
          </tr>
        </thead>
        <tbody>
          {m.rails.map((r, i) => (
            <tr key={i}>
              <td>
                <RailIcon rail={r.rail} />
              </td>
              <td>{r.chain ?? '—'}</td>
              <td className={`health-${r.health}`}>{r.health}</td>
              <td>
                <VerifyNowButton merchantId={m.id} rail={r.rail} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {m.agent_endpoints && (
        <>
          <h2>Agent endpoints</h2>
          <table>
            <tbody>
              {m.agent_endpoints.mcp_server && (
                <tr>
                  <th>MCP server</th>
                  <td>
                    <code>{m.agent_endpoints.mcp_server}</code>
                  </td>
                </tr>
              )}
              {m.agent_endpoints.auth_note && (
                <tr>
                  <th>Auth</th>
                  <td>{m.agent_endpoints.auth_note}</td>
                </tr>
              )}
              {m.agent_endpoints.api_docs && (
                <tr>
                  <th>API docs</th>
                  <td>
                    <a href={m.agent_endpoints.api_docs} target="_blank" rel="noreferrer">
                      {m.agent_endpoints.api_docs}
                    </a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      <h2>Query this merchant from an agent</h2>
      <pre className="codeblock">{`get_merchant({ id: "${m.id}" })`}</pre>
    </div>
  );
}
