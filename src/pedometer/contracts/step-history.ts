import type { RecordsByDateKey } from 'src/pedometer/types';

export type NativeDailySteps = {
  dateKey: string;
  steps: number;
};

export type NativeStepHistory = {
  todaySteps: number;
  dateKey: string;
  dailySteps: NativeDailySteps[];
};

export type AndroidStepCounterStatus = NativeStepHistory & {
  isRunning: boolean;
  isSensorAvailable: boolean;
  isActivityRecognitionGranted: boolean;
  activeSensorType: 'step-counter' | 'step-detector' | null;
  lastErrorMessage: string | null;
};

export type StepHistoryStorage = {
  load: () => Promise<RecordsByDateKey>;
  save: (records: RecordsByDateKey) => Promise<void>;
};
