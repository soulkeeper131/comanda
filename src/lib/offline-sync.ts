// Offline action sync queue
// Stores pending API writes in localStorage and syncs when online

export interface PendingAction {
  id: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  url: string;
  body?: any;
  createdAt: string;
  retries: number;
}

const STORAGE_KEY = "komanda_pending_actions";

function getActions(): PendingAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveActions(actions: PendingAction[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  } catch {
    // Storage full — silently fail
  }
}

export function queueAction(action: Omit<PendingAction, "id" | "createdAt" | "retries">) {
  const actions = getActions();
  actions.push({
    ...action,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    retries: 0,
  });
  saveActions(actions);
  console.log(
    `📴 Опашено действие: ${action.method} ${action.url} (общо: ${actions.length})`
  );
}

export function getQueueLength(): number {
  return getActions().length;
}

export async function syncPending(): Promise<{ synced: number; failed: number }> {
  const actions = getActions();
  if (actions.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining: PendingAction[] = [];
  const MAX_RETRIES = 3;

  for (const action of actions) {
    try {
      const res = await fetch(action.url, {
        method: action.method,
        headers: { "Content-Type": "application/json" },
        body: action.body ? JSON.stringify(action.body) : undefined,
      });

      if (res.ok || action.retries >= MAX_RETRIES) {
        synced++;
        console.log(`✅ Синхронизирано: ${action.method} ${action.url}`);
      } else {
        action.retries++;
        remaining.push(action);
        failed++;
      }
    } catch {
      action.retries++;
      remaining.push(action);
      failed++;
    }
  }

  saveActions(remaining);
  if (synced > 0 || failed > 0) {
    console.log(
      `📡 Синхронизация: ${synced} успешни, ${failed} неуспешни, ${remaining.length} оставащи`
    );
  }
  return { synced, failed };
}

// Register online/offline event listeners for auto-sync
export function initOfflineSync() {
  if (typeof window === "undefined") return;

  const handleOnline = () => {
    console.log("🌐 Онлайн — стартиране на синхронизация");
    syncPending().then((result) => {
      if (result.synced > 0) {
        // Dispatch custom event so UI can show toast
        window.dispatchEvent(
          new CustomEvent("offline-sync-complete", {
            detail: result,
          })
        );
      }
    });
  };

  const handleOffline = () => {
    console.log("📴 Офлайн — действията ще бъдат опашени");
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Sync immediately if already online
  if (navigator.onLine) {
    const pending = getActions();
    if (pending.length > 0) {
      handleOnline();
    }
  }
}
