import AsyncStorage from '@react-native-async-storage/async-storage';

import { defaultSettings, recordsStorageKey, settingsStorageKey } from 'src/pedometer/constants';
import { normalizeStoredSettings } from 'src/pedometer/settings';
import type { AppSettings, DailyRecord, RecordsByDateKey } from 'src/pedometer/types';

export const loadSettings = async (): Promise<AppSettings> => {
  const rawSettings = await AsyncStorage.getItem(settingsStorageKey);

  if (!rawSettings) {
    return defaultSettings;
  }

  return normalizeStoredSettings(JSON.parse(rawSettings) as Partial<AppSettings>);
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  await AsyncStorage.setItem(settingsStorageKey, JSON.stringify(settings));
};

export const loadRecords = async (): Promise<RecordsByDateKey> => {
  const rawRecords = await AsyncStorage.getItem(recordsStorageKey);

  if (!rawRecords) {
    return {};
  }

  return JSON.parse(rawRecords) as RecordsByDateKey;
};

export const saveRecord = async (recordsByDateKey: RecordsByDateKey, record: DailyRecord): Promise<RecordsByDateKey> => {
  const nextRecords = {
    ...recordsByDateKey,
    [record.dateKey]: record,
  };

  await AsyncStorage.setItem(recordsStorageKey, JSON.stringify(nextRecords));
  return nextRecords;
};

export const clearRecords = async (): Promise<void> => {
  await AsyncStorage.removeItem(recordsStorageKey);
};
