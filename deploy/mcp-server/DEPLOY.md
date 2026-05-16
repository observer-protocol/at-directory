# Hosted MCP server — deploy runbook

Target: `mcp.agenticterminal.ai` → op-vps (`observer-protocol-api`, Hetzner US East `178.156.249.143`), `deploy` user.

**Approach: Docker-less.** No Docker, no Nginx, no certbot. The box already
runs the OP production API behind a **Cloudflare Tunnel** (`cloudflared.service`,
tunnel `cda977eb-...`). The MCP server runs as a plain systemd Node service on
`127.0.0.1:8099`; a Cloudflare Tunnel ingress rule fronts it with TLS handled
end-to-end by Cloudflare. This matches existing op-vps patterns and adds no new
infra classes to a shared production box.

**Shared-box caution.** op-vps runs the live OP API (`observer-api.service`,
Postgres, `localhost:8000`) fronted by the same `cloudflared` instance. The
only step that touches shared prod is the cloudflared ingress edit (step 5).
It is gated by a config backup + `cloudflared tunnel ingress validate` before
any restart, with a one-line rollback. Treat step 5 with care.

**Node constraint.** System Node is v18 and the OP API depends on it. Node 20
is installed **side-by-side** at `/opt/node20` (official tarball, absolute path
in the unit). System Node 18 is never touched. (The build toolchain — pnpm 11,
Node 22 — is **not** needed on op-vps: a pre-built, self-contained `dist/`
artifact is shipped and only needs `npm install --omit=dev` of two runtime
deps.)

Prereqs already confirmed (2026-05-16): DNS for `mcp.agenticterminal.ai`
resolves (Cloudflare-proxied); `~/at-directory-mcp.tgz` staged on op-vps
(sha256 `355e016df30217c88e307765e3e469b96bff7e255d0b938cf7322b82e8da1c72`);
port 8099 free; no prior unit/env.

---

## Step 1 — Node 20 side-by-side (additive; Node 18 untouched)

```bash
curl -fsSL https://nodejs.org/dist/v20.18.1/node-v20.18.1-linux-x64.tar.xz -o /tmp/node20.tar.xz
sudo mkdir -p /opt/node20
sudo tar -xJf /tmp/node20.tar.xz -C /opt/node20 --strip-components=1
/opt/node20/bin/node --version    # expect: v20.18.1
node --version                    # expect: v18.x  (system Node UNCHANGED)
```

Success: first prints `v20.18.1`, second still prints `v18.x`.

## Step 2 — Stage the artifact

```bash
sudo mkdir -p /opt/at-directory-mcp
sudo tar -xzf ~/at-directory-mcp.tgz -C /opt/at-directory-mcp
cd /opt/at-directory-mcp
# Invoke npm via the Node 20 binary explicitly — npm's `env node` shebang
# + sudo's restricted PATH would otherwise run npm under system Node 18 and
# print a (harmless but noisy) EBADENGINE warning. Deps are pure JS so the
# install is correct either way; this just keeps the output clean.
sudo /opt/node20/bin/node /opt/node20/bin/npm install --omit=dev --no-package-lock
ls /opt/at-directory-mcp           # http.js package.json merchants.snapshot.json fixtures node_modules
```

Success: `http.js`, `merchants.snapshot.json`, and `node_modules/@modelcontextprotocol` present.

## Step 3 — Local smoke test (before systemd / tunnel)

```bash
PORT=8099 /opt/node20/bin/node /opt/at-directory-mcp/http.js & SMOKE=$!
sleep 2
curl -s localhost:8099/healthz      # expect: {"ok":true,"merchants":42}
kill $SMOKE
```

Success: `{"ok":true,"merchants":42}`. If not, stop — do not proceed to systemd.

## Step 4 — systemd service (new unit; touches no existing service)

Write `/etc/systemd/system/at-directory-mcp.service`:

```ini
[Unit]
Description=AT Directory MCP server (hosted HTTP)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/at-directory-mcp
Environment=PORT=8099
# AT_VERIFIER_URL intentionally unset: reads are ungated; the server runs
# the full anonymous path. Set it later when the AT verifier route is live.
ExecStart=/opt/node20/bin/node /opt/at-directory-mcp/http.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now at-directory-mcp     # enable = survives reboot
systemctl is-active at-directory-mcp             # expect: active
curl -s localhost:8099/healthz                   # expect: {"ok":true,"merchants":42}
```

Success: `active` and healthz ok. `enable` is mandatory (the 2026-05-07
start-without-enable outage lesson).

## Step 5 — Cloudflare Tunnel ingress (THE sensitive step)

Back up first. The new rule MUST go **immediately before** the
`- service: http_status:404` catch-all (ingress is order-sensitive).

```bash
sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak.$(date +%s)
```

Edit `/etc/cloudflared/config.yml` — insert these two lines directly above the
final `  - service: http_status:404` line:

```yaml
  - hostname: mcp.agenticterminal.ai
    service: http://localhost:8099
```

Resulting ingress tail must read:

```yaml
  - hostname: lnget.observerprotocol.org
    service: http://100.86.223.47:8443
    originRequest:
      noTLSVerify: true
  - hostname: mcp.agenticterminal.ai
    service: http://localhost:8099
  - service: http_status:404
```

GATE — must pass before any restart:

```bash
sudo cloudflared tunnel ingress validate    # expect: "Validating rules ... OK"
```

Bind the hostname to this tunnel via a **manual Cloudflare dashboard
CNAME**. `cloudflared tunnel route dns` does NOT work on this box: the
tunnel was migrated credentials-only, so there is no account
`cert.pem`, and `route dns` is an account-level API write that requires
it. Do not run `cloudflared tunnel login` for this (it over-privileges
the prod box). The dashboard CNAME reaches the identical end state and
matches how this tunnel's other hostnames are already wired.

In Cloudflare DNS for zone `agenticterminal.ai`:

- Type **CNAME**, Name **`mcp`**
- Target **`cda977eb-55f1-4615-abca-9fbea978bc8a.cfargotunnel.com`**
- Proxy **Proxied (orange cloud)** — mandatory for tunnel routing
- TTL Auto
- Delete any pre-existing `mcp` A record (a proxied A → the VPS IP
  cannot work; ingress is the outbound tunnel, not a public 443 listener).

Apply:

```bash
sudo systemctl restart cloudflared
systemctl is-active cloudflared              # expect: active
```

Success: `ingress validate` prints OK; after restart `cloudflared` is `active`.

### Rollback (if validate fails, restart fails, or OP API drops)

```bash
sudo cp /etc/cloudflared/config.yml.bak.<timestamp> /etc/cloudflared/config.yml
sudo systemctl restart cloudflared
```

One step, restores OP API ingress. (If `cloudflared tunnel ingress validate`
fails, do NOT restart — just fix or restore the file; the running tunnel is
unaffected until a restart.)

## Step 6 — End-to-end + shared-box regression check

```bash
# MCP through the tunnel (HTTPS, Cloudflare-terminated)
curl -s https://mcp.agenticterminal.ai/healthz
# expect: {"ok":true,"merchants":42}

curl -s -X POST https://mcp.agenticterminal.ai/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 300
# expect: JSON listing the 6 tools

# REGRESSION: OP API tunnel route still works (we touched shared ingress).
# The OP API has no /health endpoint; what matters is that the request
# reaches the origin app (any normal HTTP code) rather than a Cloudflare
# edge error (52x/53x = tunnel can't reach origin = we broke the route).
curl -s -o /dev/null -w '%{http_code}\n' https://api.observerprotocol.org/
# expect: 404 (app reached — normal, no root handler). NOT 521/522/530.
# Stronger optional check (proves an app endpoint round-trips):
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://api.observerprotocol.org/api/v1/credentials/verify
# expect: 422 (verifier shim reached and validating input)
```

Success: MCP healthz + tools/list over HTTPS, AND the OP API still returns its
normal status. Only then is the deploy done.

## Post-deploy

- Set `AT_VERIFIER_URL` in the unit + `daemon-reload` + `restart` when the AT
  verifier route is live (enables credentialed write features; reads already work).
- `journalctl -u at-directory-mcp -f` for logs.
- Redeploy = re-scp a new `dist/` tarball, re-extract to `/opt/at-directory-mcp`,
  `sudo systemctl restart at-directory-mcp`. cloudflared untouched on redeploys.

## Status

**DEPLOYED 2026-05-16.** Hosted MCP live at `https://mcp.agenticterminal.ai`
via the cloudflared tunnel on op-vps; `/healthz` → 42 merchants;
`tools/list` returns the 6 tools over SSE; OP API tunnel route unaffected.
This runbook reflects the corrections found during that run (manual
dashboard CNAME instead of `route dns`; npm via the Node 20 binary; OP API
regression check uses a real path). Subsequent deploys = re-scp a new
`dist/` tarball, re-extract, `sudo systemctl restart at-directory-mcp`;
cloudflared and DNS are untouched on redeploys.
