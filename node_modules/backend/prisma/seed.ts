import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

// Load .env explicitly — ts-node doesn't auto-load it the way
// ts-node-dev does when running the server.
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env before seeding.'
    );
  }

  console.log(`Seeding admin: "${username}"...`);

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.upsert({
    where:  { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });

  console.log(`✅ Admin "${admin.username}" seeded. ID: ${admin.id}`);

  // Seed default settings singleton so it always exists
  // before any route tries to read it.
  await prisma.settings.upsert({
  where:  { id: 'singleton' },
  update: {}, // never overwrite existing settings on re-seed
  create: {
    id:               'singleton',
    slipOkMode:       'mock',
    minTtsAmount:     0,
    profanityList:    '',
    goalLabel:        'Donation Goal',
    goalTargetAmount: 0,
    goalCurrentAmount: 0,
    goalEndsAt:       null,
    topDonatorsLimit: 5,
    timerEnabled:     false,
    timerEndsAt:      null,
    timerBaseAmount:  100,
    timerBaseMinutes: 1,
  },
  });

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
}