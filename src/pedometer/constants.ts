import type { AppSettings, ChoiceOption, HistoryPeriod, LanguageCode, TimeFormat, ViewMode } from 'src/pedometer/types';

export const colors = {
  background: '#2A2832',
  surface: '#3A3842',
  surfaceMuted: '#34323C',
  surfaceInset: '#302E37',
  surfacePressed: '#393741',
  textPrimary: '#F0EDF7',
  textSecondary: '#B3ADBF',
  textMuted: '#837C92',
  borderSubtle: '#4D4764',
  highlight: '#595374',
  shadow: '#18161D',
  primary: '#686FCC',
  primaryMuted: '#464A77',
  blue: '#5F66B7',
  blueMuted: '#414562',
  warning: '#D48B6A',
  warningMuted: '#584236',
  danger: '#D96F85',
  dangerMuted: '#5A3441',
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
};

export const settingsStorageKey = 'personal-pedometer.settings';
export const recordsStorageKey = 'personal-pedometer.records';

export const localeByLanguageCode: Record<LanguageCode, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  tr: 'tr-TR',
};

export const slideOptions: ChoiceOption<ViewMode>[] = [
  { value: 'today', label: 'Сегодня' },
  { value: 'activity', label: 'Активность' },
  { value: 'history', label: 'История' },
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

export const timeZoneByCountry: Record<string, string> = {
  Россия: 'Europe/Moscow',
  Казахстан: 'Asia/Almaty',
  Турция: 'Europe/Istanbul',
  Германия: 'Europe/Berlin',
  США: 'America/New_York',
};
