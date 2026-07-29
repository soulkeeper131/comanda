import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

export const auth = betterAuth({
  database: new Database("./data/auth.db"),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {},
  trustedOrigins: [
    "https://comanda.blv.bg",
    "http://localhost:3000",
    process.env.COOLIFY_URL || "",
  ].filter(Boolean),
});
