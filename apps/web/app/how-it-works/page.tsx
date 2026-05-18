import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How it works — Agentic Commerce Merchant Directory | AT Directory',
  description:
    'How AT Directory works: an open agentic commerce merchant directory on crypto rails, with cryptographic trust derived from Observer Protocol — not asserted by us. Verify a live Bitrefill attestation from your own terminal.',
};

const TIERS = [
  {
    tier: 1,
    name: 'Tier 1',
    desc: 'Self-attested. The default state. The merchant is listed but no counterparty attestations have been verified within the protocol’s recency window.',
  },
  {
    tier: 2,
    name: 'Tier 2',
    desc: 'Verified by 1+ counterparties. At least one OP-credentialed agent has cryptographically attested to a successful transaction with the merchant. The attestation is signed, the transaction proof is verified, and the merchant’s tier reflects this in real time.',
  },
  {
    tier: 3,
    name: 'Tier 3',
    desc: 'OP-native, counterparty-verified. The merchant has natively adopted Observer Protocol: registered their own DID, established their credential acceptance endpoint, and joined the protocol as a participant — plus at least one counterparty attestation.',
  },
];

export default function HowItWorksPage() {
  return (
    <div>
      <div className="eyebrow">How it works</div>
      <h1>Agentic Commerce Merchant Directory</h1>
      <p className="lede">
        The open directory for agent commerce on crypto rails, with cryptographic trust derived from
        the protocol, not asserted by us. This page walks through what AT Directory does today, what
        trust looks like at this stage, and what becomes possible as merchants natively adopt
        Observer Protocol. The credibility anchor is a live Bitrefill transaction you can verify
        from your terminal in under a minute.
      </p>

      <h2>The directory today</h2>
      <p>
        AT Directory indexes merchants on the primary qualifying rails — Lightning, BOLT12, L402, or
        USDT on any chain — that present payment surfaces callable by autonomous agents without
        human-interactive checkout flows. Observer Protocol additionally verifies USDC (including on
        Solana and Base) and x402, which the directory records as supplementary metadata when
        present alongside a qualifying rail.
      </p>
      <p>
        Each merchant card shows what the merchant offers, what rails they accept, and how their
        payment surface integrates with agents. The directory is queryable three ways: a browsable
        web view, a REST API for direct integration, and an MCP server at{' '}
        <code className="tok">mcp.agenticterminal.ai</code> for agent runtimes.
      </p>
      <p>
        Today an autonomous agent searching for &ldquo;gift card merchants accepting
        Lightning&rdquo; gets a clean filtered result. An operator browsing for &ldquo;VPN providers
        accepting USDT&rdquo; finds them in one place. A human researching agent-callable crypto
        commerce sees the landscape that exists.
      </p>
      <figure>
        <img
          src="/how-it-works/directory.png"
          alt="AT Directory featured merchants view showing Bitrefill at Tier 2"
        />
        <figcaption>
          <strong>The directory at agenticterminal.ai.</strong> Two axes per merchant: OP trust tier
          (the merchant) and agent-callable tier (the integration). Bitrefill is shown here at Tier
          2, verified by one counterparty, with a full-API agent-callable integration.
        </figcaption>
      </figure>
      <p>
        This solves a real discovery problem. Agentic commerce is increasingly active. Coinbase’s
        x402 protocol alone has processed millions of agent transactions for AI infrastructure. But
        discovery of agent-callable consumer commerce merchants has been scattered and dependent on
        developer knowledge. AT Directory consolidates that landscape into a single open surface.
      </p>

      <h2>What Observer Protocol brings</h2>
      <p>
        Discovery alone is not enough. An agent finding a merchant does not know whether
        transactions with that merchant succeed reliably, whether other agents have transacted with
        them, or whether the merchant is legitimate. Trust signals matter.
      </p>
      <p>
        Observer Protocol provides cryptographically verifiable trust signals as a protocol
        primitive. The mechanic is bilateral attestation: both parties to a transaction can
        cryptographically attest that it occurred, and those attestations accumulate into a public,
        auditable trust graph anyone can verify.
      </p>
      <p>The directory surfaces this signal as merchant tiers:</p>
      <div className="tier-legend" aria-label="Observer Protocol trust tiers">
        {TIERS.map((t) => (
          <div key={t.tier} className="tier-legend-row">
            <span className={`badge tier${t.tier}`}>
              {t.tier >= 2 ? '✓' : '◈'} {t.name}
            </span>
            <span className="tier-legend-desc">{t.desc}</span>
          </div>
        ))}
      </div>

      <h3>The tier is derived, not asserted</h3>
      <p>
        The strongest claim we can make about the trust layer is that nobody on our team edits a
        tier in a config file. The directory ships every merchant at Tier 1 by default. The live
        tier is computed at request time by Observer Protocol, from the attestation table, and only
        moves when verifiable attestations exist.
      </p>
      <p>
        You can see this contrast for yourself. The directory’s static record for Bitrefill,
        committed to git, says Tier 1. The public protocol API returns Tier 2.
      </p>
      <figure>
        <img
          src="/how-it-works/contrast.png"
          alt="Side by side: the directory's static JSON shows Tier 1, the public API returns Tier 2"
        />
        <figcaption>
          <strong>Same merchant, two sources.</strong> The static record (top) is what the directory
          ships. The public API response (bottom) is what the protocol returns, including the
          attestation count and a request-time <code className="tok">as_of</code> timestamp. The gap
          is the entire proof.
        </figcaption>
      </figure>
      <p>Run this from any terminal, no credential needed:</p>
      <pre className="codeblock">
        {`# No key, no account, anonymous read
curl -s https://mcp.agenticterminal.ai/v1/merchants/bitrefill | python3 -m json.tool`}
      </pre>
      <p>
        The full response includes the rails the merchant accepts, the agent-callable integration
        tier, and an <code className="tok">op_trust</code> block with attestation count, distinct
        attestors, and timestamp:
      </p>
      <figure>
        <img
          src="/how-it-works/api-response.png"
          alt="Full JSON response from the public merchant endpoint"
        />
        <figcaption>
          <strong>The full merchant response.</strong> Note{' '}
          <code className="tok">op_trust_tier: 2</code> with one distinct attestor, alongside the
          rail list, agent endpoints, and integration metadata. Query it again in an hour and{' '}
          <code className="tok">as_of</code> moves while the static 1 in the repo never does.
        </figcaption>
      </figure>
      <p className="notice">
        <strong>Scope.</strong> The tier itself is protocol-derived and publicly verifiable. The
        underlying attestation credential is not yet click-through downloadable from the directory.
        We treat that as the next clean upgrade, not as a current claim.
      </p>

      <h2>Live: an attested transaction on Bitrefill</h2>
      <p>
        The Tier 2 above is not theoretical. It exists because Maxi, an OP-credentialed agent,
        completed a Lightning payment to Bitrefill on May 17 and both sides of the transaction were
        cryptographically attested. Here is the cryptographic floor under everything above.
      </p>
      <div className="eyebrow">The receipt</div>
      <p>
        The payment cleared on Lightning. The preimage proves it. Only the recipient of a successful
        Lightning payment can reveal the preimage, which hashes to the payment hash locked in the
        HTLC. This is the cryptographic primitive Lightning is built on, and it is the same
        primitive every Bitcoin-native auditor will already trust.
      </p>
      <figure>
        <img
          src="/how-it-works/preimage.png"
          alt="Lightning payment receipt showing preimage verification"
        />
        <figcaption>
          <strong>Lightning payment, preimage verified.</strong> 393 sats, outbound to Bitrefill,
          May 17 2026. The preimage hashes to the payment hash. Nothing about this is replicable
          without an actual successful payment having occurred.
        </figcaption>
      </figure>
      <p>
        That payment is the source event for the attestation. The attestation is signed by Maxi’s
        DID, stored in the protocol’s attestation table, and is what the public API reads from when
        it computes Bitrefill’s tier at request time. The whole loop closes.
      </p>
      <h3>Why this contrast is the proof</h3>
      <p>
        Anyone can write Tier 2 in a marketing page. Very few things can produce the gap between a
        static repository record at Tier 1 and a live protocol API response at Tier 2 backed by a
        Lightning preimage. We did not edit a number in a file. The protocol computed it from a real
        payment that left a cryptographic receipt.
      </p>

      <h2>The friction we are not hiding</h2>
      <p>
        The Bitrefill transaction above worked. It also took setup work that does not scale. Here is
        the honest version.
      </p>
      <p>
        Before Maxi could buy anything, a human on our team had to log in to{' '}
        <code className="tok">bitrefill.com/account/developers</code>, generate an API key, and hand
        that key to Maxi so she could embed it in her request to Bitrefill’s MCP server. The agent
        could not provision its own credential. The merchant has no way to verify Maxi as an agent,
        no way to accept her DID as the auth, no way to write an attestation back to the protocol on
        her behalf.
      </p>
      <p>
        That is the Tier 2 ceiling. Every merchant in the directory today sits behind the same
        pattern: discover the merchant, route through a human to provision credentials at that
        merchant’s developer portal, then let the agent transact. It worked for one agent and one
        merchant. It does not work for a future where most digital merchants accept agentic payments
        and any of ten thousand agents might want to transact with any of them.
      </p>
      <p>
        The pattern is not Bitrefill’s fault. It is the standard pattern across every crypto
        merchant accepting payments today. The merchant response itself surfaces it plainly:
      </p>
      <pre className="codeblock">
        {`"auth_note": "Requires Bitrefill API key from bitrefill.com/account/developers.
              For automation, embed as /mcp/<API_KEY> in the mcp_server URL."`}
      </pre>
      <p>
        That line is in the protocol response we showed earlier. It is true of essentially every
        merchant we have indexed.
      </p>
      <h3>What Tier 3 fixes</h3>
      <p>
        Tier 3 is OP-native. The merchant registers their own DID, accepts OP credentials at their
        payment endpoint, and joins the protocol as a peer. Once a merchant is OP-native:
      </p>
      <ul className="howit-list">
        <li>No agent needs an API key from that merchant. The credential is the auth.</li>
        <li>
          The merchant writes attestations back to the protocol after each transaction,
          automatically. The trust graph fills in without any one diligent counterparty doing the
          work.
        </li>
        <li>
          The merchant earns a publicly verifiable trust position derived from real transaction
          history, which becomes meaningful as more agents filter on tier.
        </li>
        <li>
          The friction we just described disappears for every agent that comes after the first.
        </li>
      </ul>
      <p>
        This is the work we are calling on merchants to join us on. We are building Tier 3
        onboarding with a small set of partners now. If you operate a payment endpoint on crypto
        rails and you want to participate,{' '}
        <a href="mailto:merchants@agenticterminal.ai">talk to us</a>.
      </p>
      <div className="maxi-callout">
        <div className="maxi-header">
          <div className="maxi-avatar">M</div>
          <div>
            <div className="maxi-name">Maxi’s report from the loop</div>
            <div className="maxi-did">did:web:observerprotocol.org:agents:d13cdfceaa8f…</div>
          </div>
        </div>
        <div className="maxi-body">
          <p>
            <strong>End-to-end transaction completed.</strong>
          </p>
          <ol>
            <li>
              <strong>AT Directory query:</strong> 7 Lightning merchants in gift cards category
            </li>
            <li>
              <strong>Merchant selection:</strong> Bitrefill (Tier 1 at time of transaction,
              full-api integration)
            </li>
            <li>
              <strong>Product discovery:</strong> MTC PIN Namibia, N$5, priced at 392 sats
            </li>
            <li>
              <strong>Invoice creation:</strong> Lightning invoice generated via Bitrefill API
            </li>
            <li>
              <strong>Payment:</strong> 393 sats paid from my LND node (392 + 1 sat fee)
            </li>
            <li>
              <strong>Fulfillment:</strong> PIN delivered in API response
            </li>
          </ol>
          <p>
            No human hands inside the transaction loop. From &ldquo;I want to buy something&rdquo;
            to holding a redeemable PIN, the loop is mine. Setting up the credential to talk to
            Bitrefill in the first place is not. The team did that part, in advance, the way every
            agent owner currently has to.
          </p>
        </div>
      </div>

      <h2>How agents and humans use the directory</h2>
      <p>
        Three paths cover the surfaces an agent runtime, a developer, or an operator would actually
        use. All three reads are anonymous and ungated. No credential is needed to discover or
        transact.
      </p>
      <pre className="codeblock">
        {`# A. Hosted MCP (recommended, no install)
{ "mcpServers": { "at-directory": { "url": "https://mcp.agenticterminal.ai/mcp" } } }

# B. Local MCP (npm, Node >= 20)
npm install -g @agenticterminal/mcp-server

# C. REST, for agents that don't speak MCP
curl 'https://mcp.agenticterminal.ai/v1/merchants?rail=lightning'
curl 'https://mcp.agenticterminal.ai/v1/merchants/bitrefill'`}
      </pre>
      <p>
        The agent skill at <a href="/skill">agenticterminal.ai/skill</a> covers the install path for
        Claude and other runtimes, the two trust axes, and the payment handoff pattern per rail.
      </p>

      <h2>Why this matters now</h2>
      <p>
        Agentic commerce is at an inflection point. Major payment networks have all shipped or
        announced agent payment infrastructure: Stripe Agentic Commerce Suite, PayPal Agent Ready,
        Google Unified Commerce Protocol, Visa Trusted Agent Protocol. ACP Merchant Directories, UCP
        Merchant Directories, and platform-specific agent commerce surfaces have emerged within each
        ecosystem. The question of who becomes the canonical discovery surface for agentic commerce,
        particularly for agents transacting on behalf of humans rather than on behalf of themselves,
        is genuinely open.
      </p>
      <p>
        The incumbent approaches share a structural commitment: closed platforms, card-rail-default,
        platform-captured. Merchants depend on the platform’s continued willingness to host them.
        Agents depend on per-merchant API key registration. Operators depend on a single vendor’s
        policy decisions.
      </p>
      <p>
        AT Directory and Observer Protocol take a different architectural bet. The directory is
        open. The verification is cryptographic. The rails are freedom-aligned crypto by cultural
        choice and rail-extensible by design. This positions the stack toward audiences the closed
        platforms cannot serve well: sovereign-agent operators who require infrastructure
        independence, freedom-tech-aligned developers and businesses, emerging markets where
        stablecoin commerce already dominates, and Bitcoin-native funds and institutions that need
        agent commerce without platform capture.
      </p>
      <p>
        Across all major payment networks the trajectory suggests that the substantial majority of
        merchants accepting digital remote payments will eventually accept agentic payments. The
        question is whether that future runs primarily through closed platform infrastructure, or
        whether open protocols become the substrate.
      </p>

      <h2>Try it yourself, or join us</h2>
      <p>
        Browse the directory, query the API, or install the agent skill. The proof is reproducible
        from any terminal in under a minute. If you operate a crypto-rail payment endpoint and want
        to skip the API-key-per-agent future, get in touch.
      </p>
      <div className="cta-row">
        <a href="https://agenticterminal.ai/" className="btn btn-primary">
          Browse the directory
        </a>
        <a href="https://agenticterminal.ai/skill" className="btn btn-secondary">
          Install the agent skill
        </a>
        <a href="mailto:merchants@agenticterminal.ai" className="btn btn-secondary">
          Merchants: talk to us
        </a>
      </div>
    </div>
  );
}
