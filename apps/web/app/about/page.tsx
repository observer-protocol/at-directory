export default function AboutPage() {
  return (
    <div>
      <h1>About AT Directory</h1>
      <p className="lede">
        AT Directory is the open agentic commerce merchant directory where agents discover
        OP-verified merchants on the rails Bitcoin and Tether actually use. It is the verified,
        agent-callable layer on top of the fragmented agent-payment landscape.
      </p>

      <h2>Why these rails</h2>
      <p>
        AT Directory indexes Lightning, BOLT12, L402, and USDT because those are the rails that
        currently move real commerce at scale. Lightning is the sovereign endpoint for
        Bitcoin-native agents. USDT, deployed across Tron, Ethereum, Solana, and increasingly
        Lightning via Taproot Assets, is the highest-volume stablecoin rail in production today.
      </p>
      <p>
        x402-only merchants are out of scope by design — that protocol is owned by other players,
        and AT Directory occupies the rails they don&apos;t dominate. Merchants that accept x402
        alongside a qualifying rail are still indexed, with x402 noted as supplementary metadata.
      </p>
      <p>
        USDC is treated the same way: supplementary metadata on qualifying listings, with the note
        that USDC transactions through verified merchants carry the same trust as their other rails.
      </p>
      <p>
        Tier 1–3 verification through Observer Protocol applies to every listing regardless of rail.
        Agents reason over trust tier and agent-callable tier independently — the rail a merchant
        accepts and the trust we attest to are orthogonal axes.
      </p>

      <h2>Two independent axes</h2>
      <p>
        OP trust tier describes the <em>merchant</em>. Agent-callable tier describes the{' '}
        <em>integration</em>. They are independent — always read both before transacting.
      </p>
      <table>
        <thead>
          <tr>
            <th>OP trust tier (the merchant)</th>
            <th>Agent-callable tier (the integration)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Tier 1 — Self-attested.</strong> The merchant&apos;s own claim.
            </td>
            <td>
              <strong>full-api.</strong> Agent completes the purchase end to end programmatically.
            </td>
          </tr>
          <tr>
            <td>
              <strong>Tier 2 — Verified by 1+ counterparties.</strong> OP-credentialed agents
              attested real transactions.
            </td>
            <td>
              <strong>structured-handoff.</strong> Agent pays autonomously; fulfillment is
              human-handled.
            </td>
          </tr>
          <tr>
            <td>
              <strong>Tier 3 — OP-native, counterparty-verified.</strong> The merchant runs Observer
              Protocol.
            </td>
            <td>
              <strong>human-checkout.</strong> Agent discovers; a human completes the web checkout.
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        A Tier 2 human-checkout merchant and a Tier 1 full-api merchant are different propositions.
        Agents should reason about both axes.
      </p>

      <h2>What qualifies</h2>
      <p>
        A merchant is indexed if it does commerce (sells products, services, APIs, or content) AND
        accepts at least one of Lightning, BOLT12, L402, or USDT (any chain) AND has a payment
        surface callable by autonomous agents without human-only flows like CAPTCHA or 3D Secure.
        Pure wallets, exchanges, and payment infrastructure are excluded. x402-only merchants are
        excluded by design; x402 and USDC are recorded as supplementary metadata when a qualifying
        rail is also present.
      </p>

      <h2>Not in the payment path</h2>
      <p>
        AT Directory never custodies or routes funds. Agents discover merchants here and pay the
        merchant directly via the merchant&apos;s own payment endpoint.
      </p>

      <p className="notice">
        Verification is issued through Observer Protocol. Tier 2 listings link to their OP
        attestation record.
      </p>
    </div>
  );
}
