export type ViewMode = 'today' | 'activity' | 'history' | 'settings';

export type TrackingStatus = 'checking' | 'available' | 'permission-denied' | 'unavailable' | 'error';

export type HistoryPeriod = 'threeDays' | 'week' | 'month' | 'year';

export type LanguageCode = 'ru' | 'en' | 'tr';

export type TimeFormat = '24h' | '12h';

export type AppSettings = {
  dailyGoalSteps: number;
  strideLengthMeters: number;
  bodyWeightKilograms: number;
  languageCode: LanguageCode;
  country: string;
  region: string;
  timeZone: string;
  timeFormat: TimeFormat;
};

export type SettingsDraft = {
  dailyGoalSteps: string;
  strideLengthCentimeters: string;
  bodyWeightKilograms: string;
  languageCode: LanguageCode;
  country: string;
  region: string;
  timeZone: string;
  timeFormat: TimeFormat;
};

export type DailyRecord = {
  dateKey: string;
  steps: number;
  goalSteps: number;
  updatedAtIso: string;
};

export type RecordsByDateKey = Record<string, DailyRecord>;

export type HistoryPoint = {
  key: string;
  label: string;
  steps: number;
  goalSteps: number;
  isCurrent: boolean;
};

export type HistorySummary = {
  totalSteps: number;
  averageSteps: number;
  bestSteps: number;
  goalCompletionPercent: number;
};

export type WalkingMetrics = {
  progressRatio: number;
  remainingSteps: number;
  distanceKilometers: number;
  calories: number;
  activeMinutes: number;
};

export type ChoiceOption<TValue extends string> = {
  value: TValue;
  label: string;
  description?: string;
};
