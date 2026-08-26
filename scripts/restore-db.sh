#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# restore-db.sh — възстановяване от резервно копие
#
# Употреба:
#   ./scripts/restore-db.sh                          # списък с копия
#   ./scripts/restore-db.sh komanda-2026-08-16.tar.gz
#   ./scripts/restore-db.sh --check <архив>          # само проверка
#   ./scripts/restore-db.sh <архив> --yes            # без питане (при авария)
#
# ПРЕЗАПИСВА текущата база и снимки. Иска потвърждение.
# Преди презаписване прави копие на текущото състояние.
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_DIR/data"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"

CHECK_ONLY=false
ASSUME_YES=false
ARCHIVE=""

for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=true ;;
    --yes) ASSUME_YES=true ;;
    *) ARCHIVE="$arg" ;;
  esac
done

# ── Без аргумент: показва наличните копия ──────────────────────────
if [ -z "$ARCHIVE" ]; then
  echo "Налични резервни копия в $BACKUP_DIR:"
  echo ""
  if ! find "$BACKUP_DIR" -name 'komanda-*.tar.gz' -type f 2>/dev/null | grep -q .; then
    echo "  (няма)"
    echo ""
    echo "Направете копие с: npm run db:backup"
    exit 1
  fi
  # shellcheck disable=SC2012
  ls -1t "$BACKUP_DIR"/komanda-*.tar.gz | while read -r f; do
    printf "  %-40s %s\n" "$(basename "$f")" "$(du -h "$f" | cut -f1)"
  done
  echo ""
  echo "Възстановяване: ./scripts/restore-db.sh <име на файл>"
  exit 0
fi

# ── Намиране на архива ─────────────────────────────────────────────
if [ ! -f "$ARCHIVE" ]; then
  ARCHIVE="$BACKUP_DIR/$ARCHIVE"
fi
if [ ! -f "$ARCHIVE" ]; then
  echo "[RESTORE] ГРЕШКА: архивът не е намерен: $ARCHIVE" >&2
  exit 1
fi

STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

echo "[RESTORE] Разопаковане на $(basename "$ARCHIVE")…"
tar -xzf "$ARCHIVE" -C "$STAGING"

if [ ! -f "$STAGING/sqlite.db" ]; then
  echo "[RESTORE] ГРЕШКА: архивът не съдържа sqlite.db" >&2
  exit 1
fi

# ── Проверка на съдържанието ───────────────────────────────────────
if command -v sqlite3 &>/dev/null; then
  INTEGRITY="$(sqlite3 "$STAGING/sqlite.db" "PRAGMA integrity_check;" 2>&1 || echo "провалена")"
  if [ "$INTEGRITY" != "ok" ]; then
    echo "[RESTORE] ГРЕШКА: базата в архива е повредена: $INTEGRITY" >&2
    exit 1
  fi
  USERS="$(sqlite3 "$STAGING/sqlite.db" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "?")"
  PROPS="$(sqlite3 "$STAGING/sqlite.db" "SELECT COUNT(*) FROM properties;" 2>/dev/null || echo "?")"
  JOBS="$(sqlite3 "$STAGING/sqlite.db" "SELECT COUNT(*) FROM jobs;" 2>/dev/null || echo "?")"
  echo "[RESTORE] Съдържание: $USERS потребителя, $PROPS имота, $JOBS задачи."
fi

PHOTOS_IN_ARCHIVE=0
if [ -d "$STAGING/photos" ]; then
  PHOTOS_IN_ARCHIVE="$(find "$STAGING/photos" -type f | wc -l | tr -d ' ')"
  echo "[RESTORE] Снимки в архива: $PHOTOS_IN_ARCHIVE"
fi

if [ "$CHECK_ONLY" = true ]; then
  echo "[RESTORE] Проверката мина. Нищо не е променено (--check)."
  exit 0
fi

# ── Потвърждение ───────────────────────────────────────────────────
echo ""
echo "[RESTORE] Това ПРЕЗАПИСВА текущата база и снимки."

if [ "$ASSUME_YES" = false ]; then
  if [ ! -t 0 ]; then
    # При авария на сървъра често няма терминал. Затова има изричен флаг —
    # но той трябва да се напише съзнателно, не да е поведение по подразбиране.
    echo "[RESTORE] Няма терминал. Пуснете интерактивно или добавете --yes:" >&2
    echo "[RESTORE]   bash scripts/restore-db.sh <архив> --yes" >&2
    exit 1
  fi
  read -r -p 'Напишете "да", за да продължите: ' answer
  if [ "$answer" != "да" ]; then
    echo "[RESTORE] Отказано."
    exit 0
  fi
fi

# ── Копие на текущото състояние преди презаписване ─────────────────
if [ -f "$DATA_DIR/sqlite.db" ]; then
  SAFETY="$DATA_DIR/sqlite.db.преди-възстановяване-$(date +%Y%m%d_%H%M%S)"
  cp "$DATA_DIR/sqlite.db" "$SAFETY"
  echo "[RESTORE] Текущата база е запазена: $(basename "$SAFETY")"
fi

# ── Възстановяване ─────────────────────────────────────────────────
cp "$STAGING/sqlite.db" "$DATA_DIR/sqlite.db"
# WAL файловете от старата база вече не отговарят на новата
rm -f "$DATA_DIR/sqlite.db-wal" "$DATA_DIR/sqlite.db-shm"
echo "[RESTORE] Базата е възстановена."

if [ -d "$STAGING/photos" ]; then
  mkdir -p "$DATA_DIR/photos"
  cp -r "$STAGING/photos/." "$DATA_DIR/photos/"
  echo "[RESTORE] Снимките са възстановени ($PHOTOS_IN_ARCHIVE)."
fi

echo ""
echo "[RESTORE] Готово. Рестартирайте приложението."
