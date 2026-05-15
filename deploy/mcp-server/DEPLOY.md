# Hosted MCP server — deploy runbook

Target: `mcp.agenticterminal.ai` → op-vps (`observer-protocol-api`, Hetzner US East `178.156.249.143`), `deploy` user, Docker + systemd, Nginx TLS.

**Do not deploy until `mcp.agenticterminal.ai` resolves.** DNS (Cloudflare → 178.156.249.143) is going in this weekend. Verify with `dig +short mcp.agenticterminal.ai` before step 4.

## 0. Prerequisites (one-time)

- Docker installed on op-vps.
- `deploy` user in the `docker` group.
- Nginx with the existing Let's Encrypt setup.
- A GHCR pull credential if the image is private (public is simpler for v1).

## 1. Build & push the image

CI does this on a `v*` tag via `.github/workflows/publish-mcp.yml`. Manual equivalent from the repo root:

```bash
docker build -f deploy/mcp-server/Dockerfile -t ghcr.io/observer-protocol/at-directory-mcp:latest .
docker push ghcr.io/observer-protocol/at-directory-mcp:latest
```

## 2. Configure env on op-vps

```bash
sudo mkdir -p /etc/at-directory-mcp
sudo tee /etc/at-directory-mcp/env >/dev/null <<'EOF'
PORT=8099
AT_VERIFIER_URL=https://api.agenticterminal.ai/v1/credentials/verify
AT_DIRECTORY_DATA_URL=https://agenticterminal.ai/data/merchants.bundle.json
EOF
sudo chmod 600 /etc/at-directory-mcp/env
```

`AT_VERIFIER_URL` points at the real AT route once it lands (other CC session). Until then, leave it unset and the server runs anonymous-only — the demo's anonymous path still works.

## 3. Install the systemd unit

```bash
sudo cp deploy/mcp-server/at-directory-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable at-directory-mcp     # enable, not just start — survives reboot
sudo systemctl start at-directory-mcp
systemctl status at-directory-mcp
curl -s localhost:8099/healthz             # {"ok":true,"merchants":N}
```

`enable` is mandatory. A prior OP/AT cutover caused a 10-hour outage because a unit was started but not enabled and the box rebooted.

## 4. Nginx vhost + TLS (after DNS resolves)

```nginx
server {
  server_name mcp.agenticterminal.ai;
  location / { proxy_pass http://127.0.0.1:8099; proxy_http_version 1.1;
               proxy_set_header Connection ''; proxy_buffering off; }
}
```

```bash
sudo certbot --nginx -d mcp.agenticterminal.ai
curl -s https://mcp.agenticterminal.ai/healthz
```

## 5. Smoke test the MCP endpoint

```bash
curl -s -X POST https://mcp.agenticterminal.ai/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 400
```

## Rollback

```bash
sudo systemctl stop at-directory-mcp
docker pull ghcr.io/observer-protocol/at-directory-mcp:<previous-tag>
# point the unit's image tag at <previous-tag>, daemon-reload, start
```

## Status

The bundled runtime artifact (`dist/http.js` + snapshot — exactly what the
container's `CMD ["node","http.js"]` runs) is **verified standalone**: copied
outside the repo with no data dir, `npm install --omit=dev`, `/healthz` →
`{"ok":true,"merchants":20}`, and a real `search_merchants` MCP call
returns correctly. The Docker **image build itself was not run** (no Docker
daemon in the build env) — the Dockerfile is written against the verified
artifact but its layer assembly is unverified; build it once on a Docker
host before first deploy. Not deployed — also blocked on DNS. Once
`dig +short mcp.agenticterminal.ai` returns `178.156.249.143`, run steps 2–5.
