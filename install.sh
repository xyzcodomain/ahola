#!/bin/bash

set -e

echo "
 █████╗ ██╗  ██╗ ██████╗ ██╗      █████╗
██╔══██╗██║  ██║██╔═══██╗██║     ██╔══██╗
███████║███████║██║   ██║██║     ███████║
██╔══██║██╔══██║██║   ██║██║     ██╔══██║
██║  ██║██║  ██║╚██████╔╝███████╗██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝

Ahola Node Installer, Press Yes Or Enter Password When Prompted.
"


if [ "$EUID" -ne 0 ]; then
    echo "Run:"
    echo "sudo ./install.sh"
    exit 1
fi


USER_NAME=${SUDO_USER:-root}
HOME_DIR=$(eval echo ~$USER_NAME)
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"


echo "[1/9] Updating system"

apt update
apt upgrade -y


echo "[2/9] Installing base packages"

apt install -y \
curl \
wget \
git \
nano \
htop \
btop \
ufw \
ca-certificates \
gnupg \
nodejs \
npm \
caddy


echo "[2b/9] Adding Docker repository"

install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/debian/gpg \
| gpg --dearmor -o /etc/apt/keyrings/docker.gpg

chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list


apt update

apt install -y \
docker-ce \
docker-ce-cli \
containerd.io \
docker-buildx-plugin \
docker-compose-plugin


echo "[3/9] Docker setup"

systemctl enable docker
systemctl start docker

usermod -aG docker $USER_NAME


echo "[4/9] Creating Ahola filesystem"

mkdir -p $HOME_DIR/ahola/{gateway,apps,storage,minio/data,scripts,logs,docker}


if [ ! -d "$REPO_DIR/gateway" ]; then
    echo "Error: gateway/ directory not found in $REPO_DIR"
    echo "Make sure you are running this script from the cloned repo root."
    exit 1
fi


echo "[5/9] Installing gateway"

GATEWAY_SRC="$REPO_DIR/gateway"
GATEWAY_DST="$HOME_DIR/ahola/gateway"

if [ "$GATEWAY_SRC" != "$GATEWAY_DST" ]; then
    cp -r "$GATEWAY_SRC/"* "$GATEWAY_DST/"
else
    echo "Gateway source and destination are the same, skipping copy."
fi


cd $HOME_DIR/ahola/gateway

npm install


echo "[6/9] Deploy configs"

COMPOSE_SRC="$REPO_DIR/docker/compose.yml"
COMPOSE_DST="$HOME_DIR/ahola/docker/compose.yml"

if [ "$COMPOSE_SRC" != "$COMPOSE_DST" ]; then
    cp "$COMPOSE_SRC" "$COMPOSE_DST"
else
    echo "Compose file already in place, skipping copy."
fi


echo "[7/9] Configuring Caddy"

install -D -m 0644 "$REPO_DIR/docker/caddy/Caddyfile" /etc/caddy/Caddyfile

systemctl reload caddy || systemctl restart caddy


echo "[8/9] Firewall"

ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 8080/tcp

ufw --force enable


echo "[9/9] Starting containers + finalizing"

cd $HOME_DIR/ahola

docker compose \
-f "$HOME_DIR/ahola/docker/compose.yml" \
up -d

chown -R \
$USER_NAME:$USER_NAME \
$HOME_DIR/ahola

if [ "$USER_NAME" != "root" ]; then
    echo "Docker group updated."
    echo "Temporary workaround: run  newgrp docker"
    echo "Permanent: log out and back in."
fi

echo "

=================================
 AHOLA NODE READY

Home:
$HOME_DIR/ahola

Gateway:
http://localhost:8080

HTTPS:
https://localhost (via host Caddy)

MinIO Console:
http://localhost:81 (via Caddy)

MinIO API:
http://localhost:9001

Docker compose:
$HOME_DIR/ahola/docker/compose.yml

Caddy config:
/etc/caddy/Caddyfile

=================================
"
