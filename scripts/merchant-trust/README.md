# merchant-trust generator

Mints the AT Directory portable-trust artifacts: merchant DID documents, `MerchantTrustCredential`s,
and the `BitstringStatusListCredential` that carries their revocation state. All signing is
`eddsa-jcs-2022` (`DataIntegrityProof`), done locally with no network calls.

## Why this file exists

**Until 2026-08-05 this directory was untracked.** Its outputs were committed and deployed; the tool
that produced them was not, and existed on one laptop. Production was serving credentials whose
generator was in no repository.

Committed 2026-08-05, verified first:

- **The outputs were already versioned and match production.** All 134 files under
  `apps/web/public/merchants/` are tracked, as is `apps/web/public/status/merchant-trust/v1.json`.
  Sampled `bitrefill`, `coincards` and `akash` DID documents against what `agenticterminal.ai`
  serves: **byte-identical**. The status list is byte-identical to what is served at its own
  declared `id`. So the artifacts were never the gap. The tool was.
- **No key material is in this directory.** Scanned before committing, with a canary seeded to prove
  the scanner fires rather than trusting an empty result. `signing.py` loads keys from environment
  variables and never embeds one; `status-index.json` is 69 slug-to-integer mappings.

## Keys

Supplied by environment variable, never by file in this repository:

| variable | what it signs |
|---|---|
| `AT_MERCHANT_VC_SIGNING_KEY` | hex Ed25519 private key for credentials and the status list |
| `AT_MERCHANT_DID_SERVICE_KEY` | hex Ed25519 private key for the AT service key in merchant DID documents |
| `AT_MERCHANT_VC_VM` | default `verificationMethod` URI, overridable with `--vm` |

`python generate.py keygen` prints a fresh keypair. **Run it twice** for the two keys above, and put
neither in this repository.

## Use

```sh
python generate.py keygen                      # print a new Ed25519 keypair
python generate.py dids                        # merchant DID documents
python generate.py credentials                 # MerchantTrustCredentials
python generate.py status-list [--revoke 7,12] # regenerate the BitstringStatusListCredential
```

Everything lands under `apps/web/public/`, which Netlify publishes from `apps/web/out`.

**`status-index.json` is load-bearing and append-only in practice.** It maps each merchant slug to
its index in the status list bitstring. Changing an existing entry silently re-points a revocation
at a different merchant: the credential still verifies, and it now reports the wrong merchant's
status. Add new merchants at the end; do not renumber.

## What this does not do

It does not deploy, and it does not check its own output against what is live. After regenerating,
the artifacts are only correct in production once the site is rebuilt and published. Nothing here
notices if the two drift apart, which is the same class of gap that left this tool uncommitted.
