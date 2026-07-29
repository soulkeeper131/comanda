import { auth } from "@/lib/auth";

// Mock users for each role
const MOCK_USERS = [
  { email: "admin@komanda.bg", password: "admin123", name: "Владимир Тодоров", role: "admin" },
  { email: "owner@komanda.bg", password: "owner123", name: "Иван Петров", role: "owner" },
  { email: "worker@komanda.bg", password: "worker123", name: "Георги Димитров", role: "worker" },
  { email: "inspector@komanda.bg", password: "inspector123", name: "Мария Стоянова", role: "inspector" },
];

export async function seedUsers() {
  for (const user of MOCK_USERS) {
    try {
      const existing = await auth.api.signInEmail({
        body: { email: user.email, password: user.password },
        asResponse: true,
      });

      // If sign in works, user already exists
      console.log(`User ${user.email} already exists`);
    } catch {
      // User doesn't exist, create
      try {
        await auth.api.signUpEmail({
          body: {
            email: user.email,
            password: user.password,
            name: user.name,
          },
          asResponse: true,
        });
        console.log(`Created user: ${user.email} (${user.role})`);
      } catch (e: any) {
        console.error(`Failed to create ${user.email}:`, e.message);
      }
    }
  }
}
