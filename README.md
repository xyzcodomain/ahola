# Ahola Node

Turn any Debian machine into an Ahola Node.

```bash
git clone https://github.com/xyzcodomain/ahola
cd ahola
sudo ./install.sh
```

## What it sets up

- Docker + Docker Compose
- Ahola Gateway (Express reverse proxy)
- MinIO object storage
- Firewall rules
- Filesystem layout under `~/ahola`

## Services

| Service | Port | URL |
|---------|------|-----|
| Gateway | 8080 | http://localhost:8080 |
| MinIO API | 9000 | http://localhost:9000 |
| MinIO Console | 9001 | http://localhost:9001 |

## Directory layout

```
~/ahola/
├── gateway/     # Gateway source
├── apps/        # Deployed apps
├── storage/     # Storage configs
├── minio/data/  # MinIO data
├── scripts/     # Helper scripts
└── logs/        # Logs
```

## Scripts

- `scripts/update.sh` — Pull latest + restart containers
- `scripts/backup.sh` — Tar archive of `~/ahola`
