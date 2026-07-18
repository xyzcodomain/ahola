# Ahola Node

Turn any Debian machine into an Ahola Node.

```bash
git clone https://github.com/xyzcodomain/ahola
cd ahola
chmod +x install.sh
sudo ./install.sh
```

## What it sets up

- Docker CE + Docker Compose (from Docker's official repo)
- Ahola Gateway (Express reverse proxy)
- Caddy (auto-HTTPS)
- MinIO object storage
- Firewall rules
- Filesystem layout under `~/ahola`

## Wildcard DNS

Point one Cloudflare DNS record at the node:

| Type | Name | Content |
|------|------|---------|
| A | `*` | `<NODE_IP>` |

That single record covers every subdomain: `app.ahola.im`, `api.ahola.im`, etc.

## Routing

The gateway resolves requests in this order:

1. Exact hostname in `gateway/routes.json`
2. Wildcard `*.ahola.im` → app config in `~/ahola/apps/<subdomain>.json`

Example app config `~/ahola/apps/myapp.json`:

```json
{
  "target": "http://localhost:3000"
}
```

## Services

| Service | Port | URL |
|---------|------|-----|
| Gateway | 8080 | http://localhost:8080 |
| Caddy HTTPS | 443 | https://localhost |
| MinIO API | 9000 | http://localhost:9000 |
| MinIO Console | 9001 | http://localhost:81 (via Caddy) |

## Directory layout

```
~/ahola/
├── docker/       # Docker compose + Caddy config
├── caddy/        # Caddyfile
├── gateway/      # Gateway source
├── apps/         # App configs (one JSON per subdomain)
├── storage/      # Storage configs
├── minio/data/   # MinIO data
├── scripts/      # Helper scripts
└── logs/         # Logs
```

## Scripts

- `scripts/update.sh` — Pull latest + restart containers
- `scripts/backup.sh` — Tar archive of `~/ahola`

