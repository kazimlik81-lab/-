import { localeByLanguageCode } from 'src/pedometer/constants';
import type { AppSettings, DailyRecord, HistoryPeriod, HistoryPoint, HistorySummary, RecordsByDateKey, WalkingMetrics } from 'src/pedometer/types';

export const getDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getStartOfDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
};

export const getDateFromDateKey = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getDailyHistoryPoints = (
  period: Exclude<HistoryPeriod, 'year'>,
  recordsByDateKey: RecordsByDateKey,
  settings: AppSettings,
): HistoryPoint[] => {
  const today = new Date();
  const dayCount = period === 'threeDays' ? 3 : period === 'week' ? 7 : 30;
  const points: HistoryPoint[] = [];

  for (let dayOffset = dayCount - 1; dayOffset >= 0; dayOffset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    const dateKey = getDateKey(date);
    const dailyRecord = recordsByDateKey[dateKey];
    const label = new Intl.DateTimeFormat(localeByLanguageCode[settings.languageCode], {
      day: period === 'month' ? 'numeric' : undefined,
      timeZone: settings.timeZone,
      weekday: period === 'month' ? undefined : 'short',
    }).format(date);

    points.push({
      key: dateKey,
      label,
      steps: dailyRecord?.steps ?? 0,
      goalSteps: dailyRecord?.goalSteps ?? settings.dailyGoalSteps,
      isCurrent: dateKey === getDateKey(today),
    });
  }

  return points;
};

const getMonthlyHistoryPoints = (recordsByDateKey: RecordsByDateKey, settings: AppSettings): HistoryPoint[] => {
  const today = new Date();
  const points: HistoryPoint[] = [];

  for (let monthOffset = 11; monthOffset >= 0; monthOffset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    let steps = 0;

    for (const dailyRecord of Object.values(recordsByDateKey)) {
      if (dailyRecord.dateKey.startsWith(monthKey)) {
        steps += dailyRecord.steps;
      }
    }

    points.push({
      key: monthKey,
      label: new Intl.DateTimeFormat(localeByLanguageCode[settings.languageCode], {
        month: 'short',
        timeZone: settings.timeZone,
      }).format(date),
      steps,
      goalSteps: settings.dailyGoalSteps * daysInMonth,
      isCurrent: monthKey === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    });
  }

  return points;
};

export const getHistoryPoints = (
  period: HistoryPeriod,
  recordsByDateKey: RecordsByDateKey,
  settings: AppSettings,
): HistoryPoint[] => {
  if (period === 'year') {
    return getMonthlyHistoryPoints(recordsByDateKey, settings);
  }

  return getDailyHistoryPoints(period, recordsByDateKey, settings);
};

export const getHistorySummary = (historyPoints: HistoryPoint[]): HistorySummary => {
  const totalSteps = historyPoints.reduce((total, historyPoint) => total + historyPoint.steps, 0);
  const totalGoalSteps = historyPoints.reduce((total, historyPoint) => total + historyPoint.goalSteps, 0);
  const bestSteps = historyPoints.reduce((best, historyPoint) => Math.max(best, historyPoint.steps), 0);

  return {
    totalSteps,
    averageSteps: historyPoints.length > 0 ? totalSteps / historyPoints.length : 0,
    bestSteps,
    goalCompletionPercent: totalGoalSteps > 0 ? Math.round((totalSteps / totalGoalSteps) * 100) : 0,
  };
};

export const calculateWalkingMetrics = (steps: number, settings: AppSettings): WalkingMetrics => {
  const safeSteps = Math.max(0, Math.round(steps));
  const distanceKilometers = (safeSteps * settings.strideLengthMeters) / 1000;

  return {
    progressRatio: Math.min(1, safeSteps / settings.dailyGoalSteps),
    remainingSteps: Math.max(0, settings.dailyGoalSteps - safeSteps),
    distanceKilometers,
    calories: distanceKilometers * settings.bodyWeightKilograms * 1.036,
    activeMinutes: safeSteps / 100,
  };
};

export const createDailyRecord = (steps: number, settings: AppSettings): DailyRecord => {
  return {
    dateKey: getDateKey(new Date()),
    steps: Math.max(0, Math.round(steps)),
    goalSteps: settings.dailyGoalSteps,
    updatedAtIso: new Date().toISOString(),
  };
};
