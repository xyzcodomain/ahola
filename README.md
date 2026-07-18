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
- Ahola Panel (deployment dashboard)
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
| Panel | 3333 | http://localhost:3333 |
| Gateway | 8080 | http://localhost:8080 |
| Caddy HTTPS | 443 | https://localhost |
| MinIO API | 9000 | http://localhost:9000 |
| MinIO Console | 9001 | http://localhost:81 (via Caddy) |

## Nodes & Clustering

Link multiple Ahola nodes together via the Panel (port 3333):

1. Open **Nodes** tab in the panel
2. Click **Add Node**
3. Enter:
   - **Node ID**: unique name for the server
   - **Public IP**: external IP for traffic (optional for local/lab setups)
   - **Local IP**: private IP for inter-node communication
   - **Role**: `gateway`, `storage`, or `worker`

Nodes are stored in `~/ahola/nodes/` as JSON files.

### Local / Lab Setup (No Public IP)

If your nodes are on the same private network and don’t have public IPs:

1. Leave **Public IP** empty in the panel
2. Enter each node’s **Local / Private IP** only
3. The cluster will use local IPs for all inter-node communication
4. Access the panel via the local network IP: `http://192.168.x.x:3333`

This works for:
- Home labs
- Office networks
- Any environment where nodes can reach each other via private IPs

### Docker Swarm

To run MinIO in distributed mode across nodes, initialize a Docker Swarm:

```bash
# On manager node
docker swarm init --advertise-addr <MANAGER_IP>

# On worker nodes
docker swarm join --token <WORKER_TOKEN> <MANAGER_IP>:2377
```

Then deploy the stack:

```bash
cd ~/ahola
docker stack deploy -c docker/compose.yml ahola
```

### Storage by Node Count

| Nodes | Mode | Behavior |
|-------|------|----------|
| 1 | Local | Standalone MinIO on this node |
| 2 | Linked | Run independent MinIO on each node; apps can target either |
| 3 | Linked | Same as 2-node; no erasure coding yet |
| 4+ | Distributed | MinIO erasure-coded cluster across all nodes |

### Two-Node Setup

With only 2 nodes, MinIO cannot run in true distributed/erasure-coded mode. Instead:

1. Keep each node's MinIO standalone
2. Use the panel to link the second node
3. Point apps to a specific node's MinIO via target URL, e.g. `http://node2:9000`
4. Replicate critical data at the app level if needed

### Distributed MinIO (4+ nodes)

Once you have 4+ nodes linked, update the MinIO service command in `docker/compose.yml` to use distributed mode:

```yaml
command: server http://node1/data http://node2/data http://node3/data http://node4/data --console-address ":9001"
```

Each node must have a `minio/data` volume mounted and be reachable by its local IP.

## Directory layout

```
~/ahola/
├── docker/       # Docker compose + Caddy config
├── caddy/        # Caddyfile
├── gateway/      # Gateway source
├── panel/        # Deployment dashboard
│   └── public/   # Dashboard HTML
├── apps/         # App configs (one JSON per subdomain)
├── storage/      # Storage configs
├── minio/data/   # MinIO data
├── scripts/      # Helper scripts
└── logs/         # Logs
```

## Scripts

- `scripts/update.sh` — Pull latest + restart containers
- `scripts/backup.sh` — Tar archive of `~/ahola`

