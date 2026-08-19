import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AppSettings {
  // System
  slipOkMode:          string;
  minTtsAmount:        number;
  profanityList:       string[];

  // Goal
  goalLabel:           string;
  goalTargetAmount:    number;
  goalCurrentAmount:   number;
  goalEndsAt:          Date | null;
  goalBarColor:        string;
  goalTextColor:       string;
  goalFont:            string;
  goalShowCountdown:   boolean;
  goalShowPercent:     boolean;

  // Top Donators
  topDonatorsLimit:    number;
  topFont:             string;
  topTextColor:        string;
  topAccentColor:      string;
  topBarColor:         string;
  topLayout:           string;
  topShowBar:          boolean;

  // Timer
  timerEnabled:        boolean;
  timerEndsAt:         Date | null;
  timerBaseAmount:     number;
  timerBaseMinutes:    number;
  timerFont:           string;
  timerTextColor:      string;
  timerExpiredColor:   string;
  timerBackgroundColor: string;
  timerLayout:         string;
  timerAnimation:      string;

  // Alert overlay
  alertFont:           string;
  alertTextColor:      string;
  alertAccentColor:    string;
  alertGifUrl:         string;
  alertSoundUrl:       string;
  alertAnimation:      string;
  alertDuration:       number;
  alertTtsEnabled:     boolean;
  alertShowGif:        boolean;
}

let cache: AppSettings | null = null;

export async function getSettings(): Promise<AppSettings> {
  if (cache) return cache;

  const row = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  if (!row) throw new Error('Settings singleton missing — run prisma db seed.');

  cache = {
    // System
    slipOkMode:          row.slipOkMode,
    minTtsAmount:        row.minTtsAmount,
    profanityList:       row.profanityList
                           .split(',')
                           .map((w) => w.trim().toLowerCase())
                           .filter(Boolean),

    // Goal
    goalLabel:           row.goalLabel,
    goalTargetAmount:    Number(row.goalTargetAmount),
    goalCurrentAmount:   Number(row.goalCurrentAmount),
    goalEndsAt:          row.goalEndsAt,
    goalBarColor:        row.goalBarColor,
    goalTextColor:       row.goalTextColor,
    goalFont:            row.goalFont,
    goalShowCountdown:   row.goalShowCountdown,
    goalShowPercent:     row.goalShowPercent,

    // Top Donators
    topDonatorsLimit:    row.topDonatorsLimit,
    topFont:             row.topFont,
    topTextColor:        row.topTextColor,
    topAccentColor:      row.topAccentColor,
    topBarColor:         row.topBarColor,
    topLayout:           row.topLayout,
    topShowBar:          row.topShowBar,

    // Timer
    timerEnabled:        row.timerEnabled,
    timerEndsAt:         row.timerEndsAt,
    timerBaseAmount:     Number(row.timerBaseAmount),
    timerBaseMinutes:    Number(row.timerBaseMinutes),
    timerFont:           row.timerFont,
    timerTextColor:      row.timerTextColor,
    timerExpiredColor:   row.timerExpiredColor,
    timerBackgroundColor: row.timerBackgroundColor,
    timerLayout:         row.timerLayout,
    timerAnimation:      row.timerAnimation,

    // Alert overlay
    alertFont:           row.alertFont,
    alertTextColor:      row.alertTextColor,
    alertAccentColor:    row.alertAccentColor,
    alertGifUrl:         row.alertGifUrl,
    alertSoundUrl:       row.alertSoundUrl,
    alertAnimation:      row.alertAnimation,
    alertDuration:       row.alertDuration,
    alertTtsEnabled:     row.alertTtsEnabled,
    alertShowGif:        row.alertShowGif,
  };

  return cache;
}

export function invalidateSettingsCache(): void {
  cache = null;
}

export async function updateSettings(
  data: Partial<Omit<AppSettings, 'profanityList'> & { profanityList: string }>
): Promise<AppSettings> {
  await prisma.settings.update({ where: { id: 'singleton' }, data });
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

  const baseAmount  = settings.timerBaseAmount  > 0 ? settings.timerBaseAmount  : 100;
  const baseMinutes = settings.timerBaseMinutes > 0 ? settings.timerBaseMinutes : 1;
  const secondsToAdd = Math.round((donationAmount / baseAmount) * baseMinutes * 60);

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