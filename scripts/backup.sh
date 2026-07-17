#!/bin/bash

DATE=$(date +"%Y-%m-%d")

tar \
  -czf \
  ~/ahola-backup-$DATE.tar.gz \
  ~/ahola

echo "Backup done"
