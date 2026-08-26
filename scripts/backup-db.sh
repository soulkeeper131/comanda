#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# backup-db.sh — резервно копие на базата и снимките
#
# Употреба:
#   ./scripts/backup-db.sh                    # ръчно
#   0 2 * * * /app/scripts/backup-db.sh       # cron: всяка нощ в 2:00
#
# Прави архив на data/sqlite.db И data/photos/ в едно .tar.gz.
# Пази последните 7 (BACKUP_KEEP го променя).
#
# ВАЖНО: по подразбиране копията отиват в data/backups/, което е на СЪЩИЯ
# том като базата. Загуби ли се томът, копията отиват с него. Задайте
# BACKUP_DIR към друго място (примонтирана папка, мрежов дял), за да имате
# истинско резервно копие.
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_DIR/data"
DB_FILE="$DATA_DIR/sqlite.db"
PHOTOS_DIR="$DATA_DIR/photos"

BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-7}"

# ── Проверки преди работа ──────────────────────────────────────────
if [ ! -f "$DB_FILE" ]; then
  echo "[BACKUP] ГРЕШКА: базата не е намерена: $DB_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

if [ "$BACKUP_DIR" = "$DATA_DIR/backups" ]; then
  echo "[BACKUP] ВНИМАНИЕ: копията са на същия том като базата."
  echo "[BACKUP] Задайте BACKUP_DIR към външно място за истинска защита."
fi

TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

# ── Копие на базата ────────────────────────────────────────────────
# Ползва SQLite backup API — коректно при WAL режим и по време на запис.
echo "[BACKUP] Копиране на базата…"
if command -v sqlite3 &>/dev/null; then
  sqlite3 "$DB_FILE" ".backup '$STAGING/sqlite.db'"
else
  echo "[BACKUP] ВНИМАНИЕ: sqlite3 липсва, ползвам обикновено копиране."
  echo "[BACKUP] При активен запис копието може да е непълно."
  cp "$DB_FILE" "$STAGING/sqlite.db"
fi

# ── Проверка, че копието е четимо ──────────────────────────────────
# Непроверено копие не е копие. Ако базата е повредена, искаме да
# разберем сега, а не в деня, когато ни потрябва.
if command -v sqlite3 &>/dev/null; then
  echo "[BACKUP] Проверка на копието…"
  INTEGRITY="$(sqlite3 "$STAGING/sqlite.db" "PRAGMA integrity_check;" 2>&1 || echo "провалена")"
  if [ "$INTEGRITY" != "ok" ]; then
    echo "[BACKUP] ГРЕШКА: копието не е валидно: $INTEGRITY" >&2
    exit 1
  fi

  USERS="$(sqlite3 "$STAGING/sqlite.db" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")"
  JOBS="$(sqlite3 "$STAGING/sqlite.db" "SELECT COUNT(*) FROM jobs;" 2>/dev/null || echo "0")"
  echo "[BACKUP] Копието е валидно: $USERS потребителя, $JOBS задачи."
fi

# ── Снимките ───────────────────────────────────────────────────────
# Доказателството е продуктът. База без снимки е половин копие.
if [ -d "$PHOTOS_DIR" ]; then
  PHOTO_COUNT="$(find "$PHOTOS_DIR" -type f | wc -l | tr -d ' ')"
  echo "[BACKUP] Копиране на $PHOTO_COUNT снимки…"
  cp -r "$PHOTOS_DIR" "$STAGING/photos"
else
  echo "[BACKUP] Няма папка със снимки — пропускам."
fi

# ── Архивиране ─────────────────────────────────────────────────────
ARCHIVE="$BACKUP_DIR/komanda-${TIMESTAMP}.tar.gz"
echo "[BACKUP] Архивиране…"
tar -czf "$ARCHIVE" -C "$STAGING" .

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
echo "[BACKUP] Готово: $(basename "$ARCHIVE") ($SIZE)"

# ── Ротация ────────────────────────────────────────────────────────
COUNT="$(find "$BACKUP_DIR" -name 'komanda-*.tar.gz' -type f | wc -l | tr -d ' ')"
if [ "$COUNT" -gt "$BACKUP_KEEP" ]; then
  echo "[BACKUP] Ротация: пазя последните $BACKUP_KEEP…"
  # shellcheck disable=SC2012
  ls -1t "$BACKUP_DIR"/komanda-*.tar.gz | tail -n "+$((BACKUP_KEEP + 1))" | while read -r old; do
    echo "[BACKUP]   Изтривам: $(basename "$old")"
    rm -f "$old"
  done
fi

echo "[BACKUP] Налични копия: $(find "$BACKUP_DIR" -name 'komanda-*.tar.gz' -type f | wc -l | tr -d ' ')"
