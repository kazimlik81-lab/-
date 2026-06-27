import { defaultSettings } from 'src/pedometer/constants';
import type { AppSettings, SettingsDraft } from 'src/pedometer/types';

export const createSettingsDraft = (settings: AppSettings): SettingsDraft => ({
  dailyGoalSteps: String(settings.dailyGoalSteps),
  strideLengthCentimeters: String(Math.round(settings.strideLengthMeters * 100)),
  bodyWeightKilograms: String(settings.bodyWeightKilograms),
  languageCode: settings.languageCode,
  country: settings.country,
  region: settings.region,
  timeZone: settings.timeZone,
  timeFormat: settings.timeFormat,
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
  const region = settingsDraft.region.trim();

  if (!Number.isInteger(dailyGoalSteps) || dailyGoalSteps < 500 || dailyGoalSteps > 50000) {
    throw new Error('Цель должна быть от 500 до 50 000 шагов.');
  }

  if (strideLengthCentimeters < 30 || strideLengthCentimeters > 140) {
    throw new Error('Длина шага должна быть от 30 до 140 см.');
  }

  if (bodyWeightKilograms < 30 || bodyWeightKilograms > 250) {
    throw new Error('Вес должен быть от 30 до 250 кг.');
  }

  if (region.length < 2) {
    throw new Error('Укажите регион или город проживания.');
  }

  return {
    dailyGoalSteps,
    strideLengthMeters: strideLengthCentimeters / 100,
    bodyWeightKilograms,
    languageCode: settingsDraft.languageCode,
    country: settingsDraft.country,
    region,
    timeZone: settingsDraft.timeZone,
    timeFormat: settingsDraft.timeFormat,
  };
};

export const normalizeStoredSettings = (storedSettings: Partial<AppSettings>): AppSettings => {
  return {
    dailyGoalSteps: Number(storedSettings.dailyGoalSteps) || defaultSettings.dailyGoalSteps,
    strideLengthMeters: Number(storedSettings.strideLengthMeters) || defaultSettings.strideLengthMeters,
    bodyWeightKilograms: Number(storedSettings.bodyWeightKilograms) || defaultSettings.bodyWeightKilograms,
    languageCode: storedSettings.languageCode ?? defaultSettings.languageCode,
    country: storedSettings.country ?? defaultSettings.country,
    region: storedSettings.region ?? defaultSettings.region,
    timeZone: storedSettings.timeZone ?? defaultSettings.timeZone,
    timeFormat: storedSettings.timeFormat ?? defaultSettings.timeFormat,
  };
};
