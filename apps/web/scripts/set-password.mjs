// Dev helper: set a user's password using the same scrypt format as
// src/lib/password.ts. Usage: node scripts/set-password.mjs <email> <password>
import { randomBytes, scryptSync } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const email = process.argv[2] ?? "demo@example.com";
const password = process.argv[3] ?? "demo1234";

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
const stored = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;

const prisma = new PrismaClient();
try {
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash: stored },
  });
  console.log(`password set for ${user.email}`);
} finally {
  await prisma.$disconnect();
}
