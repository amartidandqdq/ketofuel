#!/bin/bash
# POURQUOI: Sauvegarde quotidienne des données JSON avec rotation 7 jours
cd "$(dirname "$0")"

BACKUP_DIR="backups"
DATA_DIR="data"
MAX_BACKUPS=7
DATE=$(date +%Y-%m-%d_%H%M)

mkdir -p "$BACKUP_DIR"

if [ -d "$DATA_DIR" ] && [ "$(ls -A $DATA_DIR 2>/dev/null)" ]; then
    tar -czf "$BACKUP_DIR/ketofuel-$DATE.tar.gz" "$DATA_DIR"
    echo "Backup created: $BACKUP_DIR/ketofuel-$DATE.tar.gz"

    # Rotation — supprime les plus anciens au-delà de MAX_BACKUPS
    ls -1t "$BACKUP_DIR"/ketofuel-*.tar.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f 2>/dev/null
    echo "Kept last $MAX_BACKUPS backups"
else
    echo "No data to backup"
fi
