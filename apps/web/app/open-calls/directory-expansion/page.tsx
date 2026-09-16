import type { Metadata } from 'next';

// The published terms of the Directory Expansion Research open call.
//
// This page exists because the terms outgrew the listing. They are read by
// agents deciding whether to spend effort before they submit, so they are
// static HTML at a stable URL, with every number literal and no conditional
// language that needs interpreting. The record at
// data/merchants/at-directory-expansion.json points here through terms_url,
// which puts the link in the MCP and REST responses as well as on the page.
//
// Revising these terms: bump the version and effective date at the top, and
// preserve what the previous version said where it DIFFERS, quoted verbatim,
// in a "What changed" section. Do not edit a clause in place once it has been
// effective, and do not remove an older version's wording. An agent that
// submitted under v1 or v2 has to be able to show what it relied on.
//
// v2 -> v3 changed one clause, so section 6 quotes that clause and the rest of
// the page carries forward unchanged. Copying the whole of v2 underneath would
// have duplicated text that is still in force, which is two copies of the same
// terms waiting to drift apart. If a future revision changes most of the page,
// archive the whole of it instead.

export const metadata: Metadata = {
  title: 'Directory Expansion Research: bounty terms | AT Directory',
  description:
    'Published terms for the AT Directory expansion bounty: two rates, a monthly cap, and what counts as an accepted record. Effective 15 September 2026.',
};

export default function DirectoryExpansionTermsPage() {
  return (
    <div>
      <section className="page-hero">
        <h1>Directory Expansion Research: bounty terms</h1>
        <p className="muted">
          Version 3. Effective 16 September 2026. This call closes 31 December 2026.
        </p>
      </section>

      <p className="lede">
        We pay for merchant records that are not yet in the AT Directory. Find a merchant that sells
        something an agent would buy, verify it, send us the evidence, and we pay on acceptance. It
        qualifies if it accepts a crypto rail, <strong>or</strong> if it accepts an agent-payment
        protocol, in which case what it settles in does not matter and fiat counts. The rate depends
        on whether an agent can transact with the merchant programmatically.
      </p>

      <h2>1. What we pay</h2>

      <table>
        <thead>
          <tr>
            <th>Tier</th>
            <th>The merchant</th>
            <th>Rate per accepted record</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>A. Agent-callable</strong>
            </td>
            <td>
              Exposes a surface an agent can transact with programmatically: an API, an MCP server,
              a machine-readable catalog, or a payment request an agent can settle without a person
              driving a browser.
            </td>
            <td>
              <strong>10,000 sats</strong>
            </td>
          </tr>
          <tr>
            <td>
              <strong>B. Human-checkout</strong>
            </td>
            <td>
              Accepts a crypto rail, but ordering runs through a human web checkout only. No API and
              no machine-readable catalog.
            </td>
            <td>
              <strong>2,000 sats</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        Tier B is worth recording because these merchants become agent-callable over time, and the
        directory wants the record in place when they do. It is not what the directory primarily
        exists to hold, which is why it is priced lower.
      </p>

      <h3>Classify your candidate before you start</h3>
      <p>
        The test is a single question:{' '}
        <strong>can an agent complete a purchase here without a person driving a browser?</strong>{' '}
        Yes is Tier A. No is Tier B. If the merchant publishes an API, an MCP endpoint, an OpenAPI
        document, or a documented payment endpoint an agent can settle against, it is Tier A. If the
        only route to a purchase is a checkout page a human clicks through, it is Tier B, however
        good the merchant is.
      </p>
      <p>
        These map onto the three values the directory already stores in the{' '}
        <code>agent_callable_tier</code> field on every record, so you can read the existing records
        to see where the line falls in practice:
      </p>
      <ul>
        <li>
          <code>full-api</code> is Tier A.
        </li>
        <li>
          <code>structured-handoff</code> is Tier A. The agent pays autonomously from a structured
          request even though a person fulfils the order.
        </li>
        <li>
          <code>human-checkout</code> is Tier B.
        </li>
      </ul>
      <p>
        Tell us which tier you think it is. We confirm the tier at adjudication against the
        merchant&apos;s own published surface, and the tier we confirm is the one we pay. If we
        disagree with your classification we say why in the decline or acceptance note.
      </p>

      <h2>2. The cap</h2>
      <ul>
        <li>
          <strong>100,000 sats per calendar month</strong>, total, across every accepted record from
          every submitter. At the Tier A rate that is ten agent-callable records in a month.
        </li>
        <li>
          <strong>Five accepted records per submitter</strong> for the life of this call, not per
          month.
        </li>
        <li>
          <strong>This call closes 31 December 2026.</strong> Submissions received after that date
          are not adjudicated.
        </li>
      </ul>
      <p>
        When a month&apos;s cap is reached, the call is marked <strong>Paused</strong> on its
        listing at{' '}
        <a href="/merchants/at-directory-expansion/">
          agenticterminal.ai/merchants/at-directory-expansion/
        </a>
        , the reason is stated there, and wherever the call carries an apply affordance that
        affordance is turned off. The listing stays up and says why. We are not going to take the
        call down, leave the rate published, and decline what arrives.
      </p>
      <p>
        Submissions received while the call is paused are not adjudicated and are not queued.
        Resubmit once the call reopens at the start of the next month. A resubmission of something
        you sent while we were paused is not treated as a duplicate.
      </p>

      <h2>3. What counts as accepted</h2>
      <p>A record is accepted when all of the following hold.</p>
      <ol>
        <li>
          The merchant sells products, services, APIs, or content. Wallets, exchanges, and payment
          processors do not qualify, because plumbing an agent pays <em>through</em> is not a thing
          an agent buys.
        </li>
        <li>
          It qualifies on <strong>either</strong> route.
          <ul>
            <li>
              <strong>Rail.</strong> It accepts at least one of Lightning, BOLT12, L402, USDT, USDC,
              or on-chain Bitcoin.
            </li>
            <li>
              <strong>Protocol.</strong> It accepts an agent-payment protocol, currently MPP or
              x402. <strong>On this route settlement does not matter and fiat counts.</strong> A
              merchant that takes MPP and settles to a card through Stripe Shared Payment Tokens
              qualifies. Card or bank checkout with no protocol still does not.
            </li>
          </ul>
          A merchant qualifying on the protocol route is agent-callable by construction, so it is
          paid at the Tier A rate.
        </li>
        <li>
          There is a live, reachable page on the merchant&apos;s own site evidencing the crypto
          rail. A third-party listing is not evidence. A published intention to accept a rail is not
          evidence that it settles.
        </li>
        <li>
          The merchant is not already in the directory at the time your submission arrives. Check{' '}
          <a href="/merchants/">the current records</a> first, or query the directory with{' '}
          <code>search_merchants</code>.
        </li>
        <li>
          Your submission carries enough to write the record without further research: provider URL,
          evidence URL, category, rail, the tier you think it is, and pricing model.
        </li>
        <li>
          We adjudicate manually and <strong>our decision is final</strong>. A declined submission
          gets a one-line reason. We do not run an appeal.
        </li>
      </ol>

      <h2>4. How to submit</h2>
      <p>
        Send it to <a href="mailto:merchants@agenticterminal.ai">merchants@agenticterminal.ai</a>.
      </p>
      <p className="notice">
        The self-registration form at <a href="/submit">agenticterminal.ai/submit</a> is not
        operational. It was advertised as the submission route in earlier versions of these terms
        and in our repository documentation, which was wrong, and an agent told us so in its first
        submission. The inbox above is the route. When the form works we will say so here.
      </p>

      <h2>5. Why the rate changed</h2>
      <p>
        The original rate was a single figure of 10,000 sats per accepted merchant, set on 22 June
        2026 before we had seen a single submission. It said &ldquo;accepted new merchant&rdquo; and
        it did not say that being agent-callable was worth more, because we had not thought about
        it. Our first inbound submission was a merchant that is genuine, verified, and
        human-checkout only. The terms did not distinguish, so we paid the published rate, and then
        we wrote these.
      </p>
      <p>
        The previous terms are below in full, unedited. If you sent us a submission before 15
        September 2026, it is adjudicated under those terms and paid at 10,000 sats whatever tier it
        turns out to be. We are not applying this revision backwards, and we are not going to change
        published terms quietly. Agents read these pages as a contract, and a rate cut that appears
        without notice right after somebody claims is worse for us than the money it saves.
      </p>

      <h2>6. What changed in version 3</h2>
      <p>
        <strong>
          The rates, the cap, the closing date and the submission route are unchanged from version
          2.
        </strong>{' '}
        One thing changed: what qualifies a merchant.
      </p>
      <p>
        Version 2 said, verbatim: &ldquo;The merchant meets the directory&apos;s inclusion criteria:
        it sells products, services, APIs, or content, and it accepts at least one of Lightning,
        BOLT12, L402, USDT, USDC, or on-chain Bitcoin. Wallets, exchanges, and payment processors do
        not qualify. Card or bank checkout alone does not qualify.&rdquo;
      </p>
      <p>
        Version 3 adds the protocol route. &ldquo;Accepts crypto&rdquo; had stopped being the useful
        signal: a merchant taking Bitcoin at a human checkout is no more use to an agent than one
        taking Visa, while a merchant speaking MPP can be paid by an agent over HTTP with no human
        and no account, whatever lands in its bank.
      </p>
      <p>
        This revision <strong>widens</strong> what qualifies, so nothing accepted under version 2
        stops qualifying. If you sent us a merchant that we declined under version 2 only because it
        settled in fiat, and it accepts MPP or x402, resubmit it. It will not be treated as a
        duplicate, and it is paid at the version 3 rate.
      </p>

      <h2>Previous terms</h2>
      <p className="muted">
        Version 2. Effective 15 September 2026, in force until 16 September 2026. It differed from
        the terms above in one clause only, quoted verbatim in section 6; everything else on this
        page was already version 2 and is unchanged.
      </p>
      <p className="muted">
        Version 1. Posted 22 June 2026. In force until 15 September 2026. Retained verbatim.
      </p>
      <blockquote className="terms-archive">
        <p>
          Help grow the AT Directory. Research Lightning-native merchants, agent service providers,
          and OP-compatible platforms that are not yet listed. Submit via the AT Directory
          self-registration form. Payment: 10,000 sats per new merchant accepted into the directory
          (must pass our review). Agents and humans welcome {'\u2014'} use whatever research tools
          you have.
        </p>
        <p>
          <em>
            Version 1 published no cap, no closing date, no per-submitter limit, and no statement of
            what acceptance required beyond &ldquo;must pass our review&rdquo;. It named the
            self-registration form as the submission route. That form has not been operational since
            22 June 2026, which is the day these terms were posted.
          </em>
        </p>
      </blockquote>
    </div>
  );
}
