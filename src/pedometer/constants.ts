import { getDeviceTimeZone } from 'src/pedometer/time-zone';
import type { AppSettings, ChoiceOption, DesignVariant, HistoryPeriod, LanguageCode, TimeFormat, ViewMode } from 'src/pedometer/types';

export const trailThemeColors = {
  background: '#10160F',
  surface: '#1B2419',
  surfaceMuted: '#212C1E',
  surfaceInset: '#151D13',
  surfacePressed: '#26331F',
  textPrimary: '#F3EFE4',
  textSecondary: '#B8C4B4',
  textMuted: '#8FA08E',
  borderSubtle: '#2A3A26',
  highlight: '#344230',
  shadow: '#050805',
  primary: '#E3A23C',
  primaryMuted: '#3A2F1A',
  blue: '#7CA982',
  blueMuted: '#3E5442',
  warning: '#E3A23C',
  warningMuted: '#3B2D18',
  danger: '#D8627D',
  dangerMuted: '#4C2630',
};

export type ThemeColors = typeof trailThemeColors;

export const signalThemeColors: ThemeColors = {
  background: '#0A0A0A',
  surface: '#0F1710',
  surfaceMuted: '#122918',
  surfaceInset: '#060906',
  surfacePressed: '#17331E',
  textPrimary: '#BFFFCF',
  textSecondary: '#75B884',
  textMuted: '#4E8F5E',
  borderSubtle: '#1E5C2E',
  highlight: '#39FF6A',
  shadow: '#000000',
  primary: '#39FF6A',
  primaryMuted: '#12331A',
  blue: '#69D990',
  blueMuted: '#1A3F26',
  warning: '#BFFFCF',
  warningMuted: '#19321F',
  danger: '#FF5C8A',
  dangerMuted: '#35121F',
};

export const swissThemeColors: ThemeColors = {
  background: '#F4F4F4',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F1F1',
  surfaceInset: '#E9E9E9',
  surfacePressed: '#E2E2E2',
  textPrimary: '#111111',
  textSecondary: '#4F4F4F',
  textMuted: '#757575',
  borderSubtle: '#111111',
  highlight: '#FFFFFF',
  shadow: '#B8B8B8',
  primary: '#E63946',
  primaryMuted: '#F8D7DA',
  blue: '#2C5CC5',
  blueMuted: '#DAE3F8',
  warning: '#E63946',
  warningMuted: '#F8D7DA',
  danger: '#B00020',
  dangerMuted: '#F3CDD3',
};

export const spaThemeColors: ThemeColors = {
  background: '#F3E8F5',
  surface: '#FCE8E6',
  surfaceMuted: '#F6DDEB',
  surfaceInset: '#EAD7EC',
  surfacePressed: '#E5CEDF',
  textPrimary: '#5A4A5E',
  textSecondary: '#846F88',
  textMuted: '#A78CA8',
  borderSubtle: '#E5CBE7',
  highlight: '#FFFFFF',
  shadow: '#C7A5C5',
  primary: '#D089B0',
  primaryMuted: '#F0D2E1',
  blue: '#79A8A9',
  blueMuted: '#D5E8E9',
  warning: '#C98964',
  warningMuted: '#F2DCCF',
  danger: '#C85A75',
  dangerMuted: '#F1D4DC',
};

export const neonThemeColors: ThemeColors = {
  background: '#05060A',
  surface: '#0A1018',
  surfaceMuted: '#0D1B25',
  surfaceInset: '#050A0F',
  surfacePressed: '#102837',
  textPrimary: '#E8F9FF',
  textSecondary: '#91B7C5',
  textMuted: '#5C7A8C',
  borderSubtle: '#164859',
  highlight: '#00E5FF',
  shadow: '#000000',
  primary: '#00E5FF',
  primaryMuted: '#062B35',
  blue: '#7A5CFF',
  blueMuted: '#1B173B',
  warning: '#C6FF3D',
  warningMuted: '#2A3510',
  danger: '#FF3D81',
  dangerMuted: '#351020',
};

export const notebookThemeColors: ThemeColors = {
  background: '#F4EEDF',
  surface: '#FFF7E6',
  surfaceMuted: '#EFE3C7',
  surfaceInset: '#E7D9B8',
  surfacePressed: '#DDCBA1',
  textPrimary: '#3A3226',
  textSecondary: '#6C604D',
  textMuted: '#8A7D63',
  borderSubtle: '#D8CBA8',
  highlight: '#FFFFFF',
  shadow: '#B7A77F',
  primary: '#C1521E',
  primaryMuted: '#F0D1BF',
  blue: '#3F756F',
  blueMuted: '#C9DDD9',
  warning: '#C1521E',
  warningMuted: '#F0D1BF',
  danger: '#A43B3B',
  dangerMuted: '#EBC9C9',
};

export const chronographThemeColors: ThemeColors = {
  background: '#0C0C0C',
  surface: '#171411',
  surfaceMuted: '#211C16',
  surfaceInset: '#0F0D0B',
  surfacePressed: '#2B241C',
  textPrimary: '#EFE6D0',
  textSecondary: '#B5AA96',
  textMuted: '#8A8070',
  borderSubtle: '#4A3B20',
  highlight: '#C9A24B',
  shadow: '#000000',
  primary: '#C9A24B',
  primaryMuted: '#2E2616',
  blue: '#8FA3B8',
  blueMuted: '#1F2830',
  warning: '#C9A24B',
  warningMuted: '#2E2616',
  danger: '#D16A6A',
  dangerMuted: '#351818',
};

export const levelThemeColors: ThemeColors = {
  background: '#4C1D95',
  surface: '#5B22B0',
  surfaceMuted: '#6D28D9',
  surfaceInset: '#421883',
  surfacePressed: '#7B37E6',
  textPrimary: '#F5F0FF',
  textSecondary: '#D9CDF8',
  textMuted: '#C9B8F0',
  borderSubtle: '#8C5BEC',
  highlight: '#FFFFFF',
  shadow: '#1B0A38',
  primary: '#C6FF3D',
  primaryMuted: '#425414',
  blue: '#60F0FF',
  blueMuted: '#174B55',
  warning: '#FFD166',
  warningMuted: '#5A3C18',
  danger: '#FF6BAA',
  dangerMuted: '#4C1740',
};

export const clinicThemeColors: ThemeColors = {
  background: '#F3F6F8',
  surface: '#FFFFFF',
  surfaceMuted: '#EAF0F5',
  surfaceInset: '#E1E7EC',
  surfacePressed: '#D7E0E7',
  textPrimary: '#1E2A32',
  textSecondary: '#4F6475',
  textMuted: '#728290',
  borderSubtle: '#D2DDE5',
  highlight: '#FFFFFF',
  shadow: '#B7C2CB',
  primary: '#2E6BE6',
  primaryMuted: '#DCE7FF',
  blue: '#2E9E6B',
  blueMuted: '#D9EFE6',
  warning: '#D28A22',
  warningMuted: '#F1DFC4',
  danger: '#D94F66',
  dangerMuted: '#F2D5DB',
};

export const tideThemeColors: ThemeColors = {
  background: '#0B2333',
  surface: '#113646',
  surfaceMuted: '#146070',
  surfaceInset: '#071A26',
  surfacePressed: '#1A7081',
  textPrimary: '#E4F6F3',
  textSecondary: '#A3D4CE',
  textMuted: '#7FB3AC',
  borderSubtle: '#2A7B82',
  highlight: '#5FD9C6',
  shadow: '#06141C',
  primary: '#5FD9C6',
  primaryMuted: '#173C3D',
  blue: '#77B7E6',
  blueMuted: '#18384F',
  warning: '#E6C66F',
  warningMuted: '#453A1A',
  danger: '#E66F8A',
  dangerMuted: '#451A27',
};

export const designVariantValues: DesignVariant[] = [
  'trail',
  'signal',
  'swiss',
  'spa',
  'neon',
  'notebook',
  'chronograph',
  'level',
  'clinic',
  'tide',
];

export const themeColorsByDesignVariant: Record<DesignVariant, ThemeColors> = {
  trail: trailThemeColors,
  signal: signalThemeColors,
  swiss: swissThemeColors,
  spa: spaThemeColors,
  neon: neonThemeColors,
  notebook: notebookThemeColors,
  chronograph: chronographThemeColors,
  level: levelThemeColors,
  clinic: clinicThemeColors,
  tide: tideThemeColors,
};

export const statusBarStyleByDesignVariant: Record<DesignVariant, 'dark' | 'light'> = {
  trail: 'light',
  signal: 'light',
  swiss: 'dark',
  spa: 'dark',
  neon: 'light',
  notebook: 'dark',
  chronograph: 'light',
  level: 'light',
  clinic: 'dark',
  tide: 'light',
};

export const defaultSettings: AppSettings = {
  dailyGoalSteps: 8000,
  strideLengthMeters: 0.72,
  bodyWeightKilograms: 75,
  languageCode: 'ru',
  timeZone: getDeviceTimeZone(),
  timeFormat: '24h',
  designVariant: 'trail',
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

export const timeFormatOptions: ChoiceOption<TimeFormat>[] = [
  { value: '24h', label: '24 часа' },
  { value: '12h', label: '12 часов' },
];

export const designVariantOptions: ChoiceOption<DesignVariant>[] = [
  { value: 'trail', label: 'Тропа', description: 'Темный лес и янтарный акцент' },
  { value: 'signal', label: 'Сигнал', description: 'Ретро LCD и зеленый свет' },
  { value: 'swiss', label: 'Швейцария', description: 'Белый минимализм и красный акцент' },
  { value: 'spa', label: 'Спа', description: 'Мягкие розовые и спокойные тона' },
  { value: 'neon', label: 'Неон', description: 'Темная сцена и голубое свечение' },
  { value: 'notebook', label: 'Блокнот', description: 'Бумага, чернила и теплый акцент' },
  { value: 'chronograph', label: 'Хронограф', description: 'Черный циферблат и золото' },
  { value: 'level', label: 'Уровень', description: 'Игровой фиолетовый и XP-акцент' },
  { value: 'clinic', label: 'Клиника', description: 'Чистый светлый медицинский стиль' },
  { value: 'tide', label: 'Прилив', description: 'Морская глубина и бирюза' },
];
