#!/bin/bash

cd ~/ahola

git pull

docker compose pull

docker compose up -d

echo "Updated."
