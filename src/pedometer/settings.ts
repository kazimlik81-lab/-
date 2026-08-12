import { defaultSettings, designVariantValues } from 'src/pedometer/constants';
import { getDeviceTimeZone } from 'src/pedometer/time-zone';
import type { AppSettings, DesignVariant, SettingsDraft } from 'src/pedometer/types';

export const createSettingsDraft = (settings: AppSettings): SettingsDraft => ({
  dailyGoalSteps: String(settings.dailyGoalSteps),
  strideLengthCentimeters: String(Math.round(settings.strideLengthMeters * 100)),
  bodyWeightKilograms: String(settings.bodyWeightKilograms),
  languageCode: settings.languageCode,
  timeFormat: settings.timeFormat,
  designVariant: settings.designVariant,
});

const parseRequiredNumber = (rawValue: string, fieldName: string): number => {
  const parsedValue = Number(rawValue.replace(',', '.').trim());

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${fieldName}: введите число.`);
  }

  return parsedValue;
};

export const parseSettingsDraft = (settingsDraft: SettingsDraft): AppSettings => {
  const dailyGoalSteps = Math.round(parseRequiredNumber(settingsDraft.dailyGoalSteps, 'Цель'));
  const strideLengthCentimeters = parseRequiredNumber(settingsDraft.strideLengthCentimeters, 'Длина шага');
  const bodyWeightKilograms = parseRequiredNumber(settingsDraft.bodyWeightKilograms, 'Вес');

  if (!Number.isInteger(dailyGoalSteps) || dailyGoalSteps < 500 || dailyGoalSteps > 50000) {
    throw new Error('Цель должна быть от 500 до 50 000 шагов.');
  }

  if (strideLengthCentimeters < 30 || strideLengthCentimeters > 140) {
    throw new Error('Длина шага должна быть от 30 до 140 см.');
  }

  if (bodyWeightKilograms < 30 || bodyWeightKilograms > 250) {
    throw new Error('Вес должен быть от 30 до 250 кг.');
  }

  return {
    dailyGoalSteps,
    strideLengthMeters: strideLengthCentimeters / 100,
    bodyWeightKilograms,
    languageCode: settingsDraft.languageCode,
    timeZone: getDeviceTimeZone(),
    timeFormat: settingsDraft.timeFormat,
    designVariant: settingsDraft.designVariant,
  };
};

type StoredSettingsInput = Partial<AppSettings> & {
  themeMode?: unknown;
};

const isDesignVariant = (rawValue: unknown): rawValue is DesignVariant => {
  return typeof rawValue === 'string' && designVariantValues.includes(rawValue as DesignVariant);
};

const getStoredDesignVariant = (storedSettings: StoredSettingsInput): DesignVariant => {
  if (isDesignVariant(storedSettings.designVariant)) {
    return storedSettings.designVariant;
  }

  if (storedSettings.themeMode === 'day') {
    return 'clinic';
  }

  if (storedSettings.themeMode === 'night') {
    return 'trail';
  }

  return defaultSettings.designVariant;
};

export const normalizeStoredSettings = (storedSettings: StoredSettingsInput): AppSettings => {
  return {
    dailyGoalSteps: Number(storedSettings.dailyGoalSteps) || defaultSettings.dailyGoalSteps,
    strideLengthMeters: Number(storedSettings.strideLengthMeters) || defaultSettings.strideLengthMeters,
    bodyWeightKilograms: Number(storedSettings.bodyWeightKilograms) || defaultSettings.bodyWeightKilograms,
    languageCode: storedSettings.languageCode ?? defaultSettings.languageCode,
    timeZone: getDeviceTimeZone(),
    timeFormat: storedSettings.timeFormat ?? defaultSettings.timeFormat,
    designVariant: getStoredDesignVariant(storedSettings),
  };
};
