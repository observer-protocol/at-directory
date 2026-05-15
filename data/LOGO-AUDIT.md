# Logo audit

`apps/web/public/logos/<id>.svg` currently holds **monogram placeholders**
(auto-generated) so the UI renders. Real brand marks must be swapped in by
a human before launch. This file is the audit + sourcing checklist.

## Policy

Directory listings displaying a merchant's mark for identification is
standard nominative fair use, the same posture every comparison/directory
site takes. Source each mark from the merchant's own brand/press kit or
favicon, prefer SVG, keep it ~64×64, do not alter the mark, and remove on
request. Anything ambiguous: leave the placeholder and flag in the
"License note" column.

## Checklist (20 merchants)

| id | Source to pull from | License note | Status |
|---|---|---|---|
| bitrefill | bitrefill.com brand assets / favicon | nominative use | placeholder |
| travala | travala.com press kit | nominative use | placeholder |
| coinsbee | coinsbee.com favicon | nominative use | placeholder |
| coingate | coingate.com/about/media | has media kit | placeholder |
| mullvad | mullvad.net press | press assets available | placeholder |
| ivpn | ivpn.net | nominative use | placeholder |
| shopinbit | shopinbit.com | nominative use | placeholder |
| bitgild | bitgild.com favicon | nominative use | placeholder |
| coincards | coincards.com | nominative use | placeholder |
| keys4coins | keys4coins.com | nominative use | placeholder |
| bitcoin-hotel | bitcoin-hotel.de | confirm mark vs. wordmark | placeholder |
| satoshi-coffee-co | site favicon | small brand, confirm | placeholder |
| voltage | voltage.cloud brand | has brand page | placeholder |
| stacker-news | stacker.news favicon | open-source project | placeholder |
| fountain | fountain.fm press | nominative use | placeholder |
| wavlake | wavlake.com | nominative use | placeholder |
| geyser | geyser.fund | open-source project | placeholder |
| sphinx | sphinx.chat | nominative use | placeholder |
| stakwork | stakwork.com | nominative use | placeholder |
| starbackr | starbackr.com | confirm current branding | placeholder |

## Swap procedure

1. Download the SVG (or highest-res PNG → trace/keep PNG and rename `.svg` only if SVG).
2. Save as `apps/web/public/logos/<id>.svg`, ~64×64, transparent or solid square.
3. Set the row Status to `done` with the source URL.
4. The card UI (`MerchantCard`) already points at `/logos/<id>.svg`; no code change.
