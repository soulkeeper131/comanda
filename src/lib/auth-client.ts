import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "https://comanda.blv.bg",
});

export const { signIn, signOut, signUp, useSession } = authClient;
