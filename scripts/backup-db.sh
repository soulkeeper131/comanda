#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# backup-db.sh — SQLite database backup for cron
#
# Usage:
#   ./scripts/backup-db.sh              # manual run
#   0 2 * * * /app/scripts/backup-db.sh # cron: daily at 2 AM
#
# Copies data/sqlite.db → data/backups/sqlite-{date}.db.gz
# Keeps only the last 7 backups (rotates old ones).
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_DIR/data"
DB_FILE="$DATA_DIR/sqlite.db"
BACKUP_DIR="$DATA_DIR/backups"

# ── Pre-flight checks ──────────────────────────────────────────────
if [ ! -f "$DB_FILE" ]; then
  echo "[BACKUP] ERROR: sqlite.db not found at $DB_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# ── Create backup ──────────────────────────────────────────────────
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
BACKUP_NAME="sqlite-${TIMESTAMP}.db"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

echo "[BACKUP] Copying $DB_FILE → $BACKUP_PATH"

# Use SQLite backup API for safe copy (handles WAL mode correctly)
if command -v sqlite3 &>/dev/null; then
  sqlite3 "$DB_FILE" ".backup '$BACKUP_PATH'"
else
  # Fallback: plain file copy (less safe during writes)
  cp "$DB_FILE" "$BACKUP_PATH"
fi

# ── Compress ───────────────────────────────────────────────────────
echo "[BACKUP] Compressing..."
gzip -f "$BACKUP_PATH"
COMPRESSED="$BACKUP_PATH.gz"

SIZE=$(du -h "$COMPRESSED" | cut -f1)
echo "[BACKUP] Done: $BACKUP_NAME.gz ($SIZE)"

# ── Rotate: keep last 7 ────────────────────────────────────────────
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 7 ]; then
  echo "[BACKUP] Rotating: removing old backups (keeping last 7)..."
  ls -1t "$BACKUP_DIR"/*.gz | tail -n +8 | while read -r old; do
    echo "[BACKUP]   Removing: $(basename "$old")"
    rm -f "$old"
  done
  echo "[BACKUP] Rotation complete."
fi

echo "[BACKUP] Current backups: $(ls -1 "$BACKUP_DIR"/*.gz 2>/dev/null | wc -l)"
