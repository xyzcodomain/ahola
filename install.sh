#!/bin/bash

set -e

echo "
 █████╗ ██╗  ██╗ ██████╗ ██╗      █████╗
██╔══██╗██║  ██║██╔═══██╗██║     ██╔══██╗
███████║███████║██║   ██║██║     ███████║
██╔══██║██╔══██║██║   ██║██║     ██╔══██║
██║  ██║██║  ██║╚██████╔╝███████╗██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝

Ahola Node Installer
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


echo "[2/9] Installing packages"

apt install -y \
curl \
wget \
git \
nano \
htop \
btop \
ca-certificates \
nodejs \
npm \
docker.io \
docker-compose-plugin \
caddy


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

cp -r "$REPO_DIR/gateway/"* \
$HOME_DIR/ahola/gateway/


cd $HOME_DIR/ahola/gateway

npm install


echo "[6/9] Deploy configs"

cp "$REPO_DIR/docker/compose.yml" \
"$HOME_DIR/ahola/docker/compose.yml"

mkdir -p "$HOME_DIR/ahola/caddy"
cp -r "$REPO_DIR/docker/caddy/"* \
"$HOME_DIR/ahola/caddy/"


echo "[7/9] Firewall + SSL"
echo "Depricated: Caddy will handle SSL automatically"


echo "[8/9] Starting containers"

cd $HOME_DIR/ahola

docker compose \
-f "$HOME_DIR/ahola/docker/compose.yml" \
up -d


echo "[9/9] Complete"

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
https://localhost (via Caddy)

MinIO:
http://localhost:9001

Docker compose:
$HOME_DIR/ahola/docker/compose.yml

=================================
"
