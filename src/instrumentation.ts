/**
 * Неприхванати грешки на сървъра — в лога на контейнера (Coolify → Logs)
 * с час и тип, вместо процесът да умре мълчаливо или грешката да се изгуби.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  process.on("unhandledRejection", (reason) => {
    console.error(`[${new Date().toISOString()}] [unhandledRejection]`, reason);
  });
  process.on("uncaughtExceptionMonitor", (err, origin) => {
    console.error(`[${new Date().toISOString()}] [${origin}]`, err);
  });
}
