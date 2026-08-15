export { SESSION_COOKIE, signSession, verifySession, getSessionSecret } from "./session";
export type { Role, SessionData } from "./session";
export { withAuth } from "./guard";
export type { AuthedContext, AuthOptions } from "./guard";
export * from "./policy";

// ────────────────────────────────────────────────────────────────────
// Преходни реекспорти от старата реализация (`legacy.ts`).
//
// Старият `src/lib/auth.ts` беше отделен файл до Task 8. Понеже TypeScript
// резолвва файл преди папка със същото име, `@/lib/auth` сочеше към него и
// `withAuth` беше невидим за всички routes. Затова файлът е преместен тук
// като `legacy.ts` и се реекспортира — така двата пътя на импорт съвпадат.
//
// `validateUser`, `getUser` и `listUsers` четат от базата и остават.
// `setSession`/`getSession`/`clearSession` още ползват наивния `sign()` и
// се махат в Task 9, когато login мине изцяло на HMAC.
// ────────────────────────────────────────────────────────────────────
export {
  validateUser,
  createUser,
  getUser,
  listUsers,
  setSession,
  clearSession,
  getSession,
} from "./legacy";
export type { User } from "./legacy";
