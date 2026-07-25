import type { AppSettings, ChoiceOption, HistoryPeriod, LanguageCode, ThemeMode, TimeFormat, ViewMode } from 'src/pedometer/types';

export const nightThemeColors = {
  background: '#171619',
  surface: '#242128',
  surfaceMuted: '#2A2830',
  surfaceInset: '#1E1C22',
  surfacePressed: '#313039',
  textPrimary: '#F2EEF6',
  textSecondary: '#C8C0D0',
  textMuted: '#8F8798',
  borderSubtle: '#46404F',
  highlight: '#5A5266',
  shadow: '#0B0A0D',
  primary: '#59B98E',
  primaryMuted: '#244D3C',
  blue: '#6B8EDB',
  blueMuted: '#2E3E69',
  warning: '#D99552',
  warningMuted: '#533B2A',
  danger: '#D8627D',
  dangerMuted: '#552B38',
};

export type ThemeColors = typeof nightThemeColors;

export const dayThemeColors: ThemeColors = {
  background: '#F3F5F0',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF1EA',
  surfaceInset: '#E7EBE4',
  surfacePressed: '#DDE5DC',
  textPrimary: '#1F2933',
  textSecondary: '#53606B',
  textMuted: '#7C8791',
  borderSubtle: '#CBD4CC',
  highlight: '#FFFFFF',
  shadow: '#BEC8C1',
  primary: '#267A5D',
  primaryMuted: '#D7E9DF',
  blue: '#326DA8',
  blueMuted: '#D9E5F2',
  warning: '#B66C2D',
  warningMuted: '#F1E2D3',
  danger: '#B94E61',
  dangerMuted: '#F1D9DE',
};

export const themeColorsByMode: Record<ThemeMode, ThemeColors> = {
  day: dayThemeColors,
  night: nightThemeColors,
};

export const defaultSettings: AppSettings = {
  dailyGoalSteps: 8000,
  strideLengthMeters: 0.72,
  bodyWeightKilograms: 75,
  languageCode: 'ru',
  country: 'Россия',
  region: 'Москва',
  timeZone: 'Europe/Moscow',
  timeFormat: '24h',
  themeMode: 'night',
};

export const settingsStorageKey = 'personal-pedometer.settings';
export const recordsStorageKey = 'personal-pedometer.records';
export const foodAnalysisApiKeyStorageKey = 'personal-pedometer.food-analysis-api-key';
export const appUpdateCheckIntervalMilliseconds = 15 * 60 * 1000;

export const openAiResponsesApiUrl = 'https://api.openai.com/v1/responses';
export const usdaFoodDataCentralSearchUrl = 'https://api.nal.usda.gov/fdc/v1/foods/search';
export const defaultUsdaFoodDataCentralApiKey = 'DEMO_KEY';
export const defaultFoodCalorieVisionModel = 'gpt-5.6-luna';
export const defaultFoodServingGrams = 200;
export const foodPhotoJpegQuality = 0.68;
export const maximumFoodPhotoBytes = 16 * 1024 * 1024;
export const maximumFoodServingGrams = 5000;
export const maximumReasonableFoodCalories = 25000;
export const missingOpenAiApiKeyMessage = 'Сервис оценки калорий не подключен.';

export const localeByLanguageCode: Record<LanguageCode, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  tr: 'tr-TR',
};

export const slideOptions: ChoiceOption<ViewMode>[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'activity', label: 'Активность' },
  { value: 'history', label: 'История' },
  { value: 'food', label: 'Еда' },
  { value: 'settings', label: 'Настройки' },
];

export const historyPeriodOptions: ChoiceOption<HistoryPeriod>[] = [
  { value: 'threeDays', label: '3 дня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
];

export const languageOptions: ChoiceOption<LanguageCode>[] = [
  { value: 'ru', label: 'Русский', description: 'Интерфейс и даты по-русски' },
  { value: 'en', label: 'English', description: 'English date and number format' },
  { value: 'tr', label: 'Türkçe', description: 'Turkish date and number format' },
];

export const countryOptions: ChoiceOption<string>[] = [
  { value: 'Россия', label: 'Россия', description: 'Europe/Moscow' },
  { value: 'Казахстан', label: 'Казахстан', description: 'Asia/Almaty' },
  { value: 'Турция', label: 'Турция', description: 'Europe/Istanbul' },
  { value: 'Германия', label: 'Германия', description: 'Europe/Berlin' },
  { value: 'США', label: 'США', description: 'America/New_York' },
];

export const timeZoneOptions: ChoiceOption<string>[] = [
  { value: 'Europe/Moscow', label: 'Москва', description: 'UTC+03' },
  { value: 'Asia/Almaty', label: 'Алматы', description: 'UTC+05' },
  { value: 'Europe/Istanbul', label: 'Стамбул', description: 'UTC+03' },
  { value: 'Europe/Berlin', label: 'Берлин', description: 'UTC+01/02' },
  { value: 'America/New_York', label: 'Нью-Йорк', description: 'UTC-05/04' },
];

export const timeFormatOptions: ChoiceOption<TimeFormat>[] = [
  { value: '24h', label: '24 часа' },
  { value: '12h', label: '12 часов' },
];

export const themeModeOptions: ChoiceOption<ThemeMode>[] = [
  { value: 'day', label: 'Дневной', description: 'Светлый экран для яркого освещения' },
  { value: 'night', label: 'Ночной', description: 'Темный экран для вечера и ночи' },
];

export const timeZoneByCountry: Record<string, string> = {
  Россия: 'Europe/Moscow',
  Казахстан: 'Asia/Almaty',
  Турция: 'Europe/Istanbul',
  Германия: 'Europe/Berlin',
  США: 'America/New_York',
};
