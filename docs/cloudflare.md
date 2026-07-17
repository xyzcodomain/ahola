# Cloudflare DNS + Tunnel

Use a single wildcard DNS entry so every subdomain routes to the same Ahola node.

## DNS

In Cloudflare DNS, add one A record:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `*` | `<NODE_IP>` | Proxied |

That single record covers `anything.ahola.xyz`, `app.ahola.xyz`, `api.ahola.xyz`, etc.

## Tunnel

Point the tunnel at the wildcard origin:

```bash
cloudflared tunnel route dns ahola-node *.ahola.xyz
```

## Gateway routing

The gateway receives requests for any `*.ahola.xyz` hostname. The subdomain becomes the app identifier.

## Quick start

```bash
cloudflared tunnel --url http://localhost:8080
```

## Systemd service

Create `/etc/systemd/system/cloudflared.service`:

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared tunnel run ahola-node
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now cloudflared
```
