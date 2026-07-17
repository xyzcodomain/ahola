# Docker Swarm

Ahola supports Docker Swarm mode for multi-node orchestration.

## Init a manager

```bash
docker swarm init --advertise-addr <MANAGER_IP>
```

The command outputs a join token. Save it securely.

## Join a worker

```bash
docker swarm join --token <WORKER_TOKEN> <MANAGER_IP>:2377
```

## Deploy the stack

```bash
cd ~/ahola
docker stack deploy -c docker/compose.yml ahola
```

## Services

The stack exposes:

- `gateway` — reverse proxy
- `minio` — object storage

## Scaling

```bash
docker service scale ahola_gateway=3
docker service scale ahola_minio=1
```

## Rolling update

```bash
docker service update --image node:22 ahola_gateway
```

## Leave the swarm

```bash
docker swarm leave --force
```

Manager only:

```bash
docker swarm leave --force
# Then on worker nodes:
docker swarm leave
```
