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
  update: {},
  create: {
    id: 'singleton',
    // System
    slipOkMode: 'mock', minTtsAmount: 0, profanityList: '',
    // Goal
    goalLabel: 'Donation Goal', goalTargetAmount: 0, goalCurrentAmount: 0,
    goalEndsAt: null, goalBarColor: '#38E1C6', goalTextColor: '#FFFFFF',
    goalFont: 'Oswald', goalShowCountdown: true, goalShowPercent: true,
    // Top donators
    topDonatorsLimit: 5, topFont: 'Oswald', topTextColor: '#FFFFFF',
    topAccentColor: '#FFB627', topBarColor: '#38E1C6',
    topLayout: 'list', topShowBar: true,
    // Timer
    timerEnabled: false, timerEndsAt: null,
    timerBaseAmount: 100, timerBaseMinutes: 1,
    timerFont: 'IBM Plex Mono', timerTextColor: '#38E1C6',
    timerExpiredColor: '#FF3B5C', timerBackgroundColor: 'transparent',
    timerLayout: 'digital', timerAnimation: 'pulse',
    // Alert
    alertFont: 'Oswald', alertTextColor: '#FFFFFF', alertAccentColor: '#38E1C6',
    alertGifUrl: '', alertSoundUrl: '', alertAnimation: 'slide-up',
    alertDuration: 7000, alertTtsEnabled: true, alertShowGif: false,
  },
});

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
}