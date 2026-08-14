import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AppSettings {
  slipOkMode:          string;
  minTtsAmount:        number;
  profanityList:       string[];

  goalLabel:           string;
  goalTargetAmount:    number;
  goalCurrentAmount:   number;
  goalEndsAt:          Date | null;
  goalBarColor:      string;
  goalTextColor:     string;
  goalFont:          string;
  goalShowCountdown: boolean;
  goalShowPercent:   boolean;

  topDonatorsLimit:    number;

  timerEnabled:        boolean;
  timerEndsAt:         Date | null;
  timerBaseAmount:     number;
  timerBaseMinutes:    number;
}

let cache: AppSettings | null = null;

export async function getSettings(): Promise<AppSettings> {
  if (cache) return cache;

  const row = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  if (!row) throw new Error('Settings singleton missing — run prisma db seed.');

  cache = {
    slipOkMode:         row.slipOkMode,
    minTtsAmount:       row.minTtsAmount,
    profanityList:      row.profanityList
                          .split(',')
                          .map((w) => w.trim().toLowerCase())
                          .filter(Boolean),
    goalLabel:          row.goalLabel,
    goalTargetAmount:   Number(row.goalTargetAmount),
    goalCurrentAmount:  Number(row.goalCurrentAmount),
    goalEndsAt:         row.goalEndsAt,
    goalBarColor:      row.goalBarColor,
    goalTextColor:     row.goalTextColor,
    goalFont:          row.goalFont,
    goalShowCountdown: row.goalShowCountdown,
    goalShowPercent:   row.goalShowPercent,
    topDonatorsLimit:   row.topDonatorsLimit,
    timerEnabled:       row.timerEnabled,
    timerEndsAt:        row.timerEndsAt,
    timerBaseAmount:    Number(row.timerBaseAmount),
    timerBaseMinutes:   Number(row.timerBaseMinutes),
  };

  return cache;
}

export function invalidateSettingsCache(): void {
  cache = null;
}

export async function updateSettings(
  data: Partial<Omit<AppSettings, 'profanityList'> & { profanityList: string }>
): Promise<AppSettings> {
  await prisma.settings.update({
    where: { id: 'singleton' },
    data,
  });
  invalidateSettingsCache();
  return getSettings();
}

export async function incrementGoalAmount(amount: number): Promise<void> {
  await prisma.settings.update({
    where: { id: 'singleton' },
    data:  { goalCurrentAmount: { increment: amount } },
  });
  invalidateSettingsCache();
}

export async function addTimerTime(donationAmount: number): Promise<Date | null> {
  const settings = await getSettings();
  if (!settings.timerEnabled) return null;

  // Guard against division by zero
  const baseAmount  = settings.timerBaseAmount  > 0 ? settings.timerBaseAmount  : 100;
  const baseMinutes = settings.timerBaseMinutes > 0 ? settings.timerBaseMinutes : 1;

  const minutesToAdd = (donationAmount / baseAmount) * baseMinutes;
  const secondsToAdd = Math.round(minutesToAdd * 60);

  const base = settings.timerEndsAt && settings.timerEndsAt > new Date()
    ? settings.timerEndsAt
    : new Date();

  const newEndsAt = new Date(base.getTime() + secondsToAdd * 1000);

  await prisma.settings.update({
    where: { id: 'singleton' },
    data:  { timerEndsAt: newEndsAt },
  });

  invalidateSettingsCache();
  return newEndsAt;
}

export function shouldReadAloud(amount: number, minTtsAmount: number): boolean {
  return minTtsAmount === 0 || amount >= minTtsAmount;
}