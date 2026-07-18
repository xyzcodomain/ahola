#!/bin/bash

set -e

echo "
 █████╗ ██╗  ██╗ ██████╗ ██╗      █████╗
██╔══██╗██║  ██║██╔═══██╗██║     ██╔══██╗
███████║███████║██║   ██║██║     ███████║
██╔══██║██╔══██║██║   ██║██║     ██╔══██║
██║  ██║██║  ██║╚██████╔╝███████╗██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝

Ahola Node Uninstaller
"


if [ "$EUID" -ne 0 ]; then
    echo "Run:"
    echo "sudo ./uninstall.sh"
    exit 1
fi

read -p "This will remove Ahola, Docker, Caddy, and all related data. Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

USER_NAME=${SUDO_USER:-root}
HOME_DIR=$(eval echo ~$USER_NAME)


echo "[1/6] Stopping containers"

cd $HOME_DIR/ahola 2>/dev/null || true

docker compose \
-f "$HOME_DIR/ahola/docker/compose.yml" \
down -v --remove-orphans 2>/dev/null || true


echo "[2/6] Removing Ahola files"

rm -rf $HOME_DIR/ahola


echo "[3/6] Removing Caddy config"

rm -f /etc/caddy/Caddyfile

systemctl reload caddy 2>/dev/null || \
systemctl restart caddy 2>/dev/null || true


echo "[4/6] Removing packages"

apt remove -y \
caddy \
ufw \
btop \
htop \
nano \
git \
wget \
curl \
ca-certificates \
gnupg \
nodejs \
npm \
docker-ce \
docker-ce-cli \
containerd.io \
docker-buildx-plugin \
docker-compose-plugin 2>/dev/null || true


echo "[5/6] Removing Docker repo and cleanup"

rm -f /etc/apt/sources.list.d/docker.list
rm -f /etc/apt/keyrings/docker.gpg

apt update

apt autoremove -y

gpasswd -d $USER_NAME docker 2>/dev/null || true


echo "[6/6] Disabling services"

systemctl disable docker 2>/dev/null || true
systemctl disable caddy 2>/dev/null || true
systemctl stop docker 2>/dev/null || true
systemctl stop caddy 2>/dev/null || true


ufw disable 2>/dev/null || true


echo "

=================================
 AHOLA UNINSTALLED

Note: /var/lib/docker may still contain
images/volumes. Remove manually if needed:
  sudo rm -rf /var/lib/docker

=================================
"
