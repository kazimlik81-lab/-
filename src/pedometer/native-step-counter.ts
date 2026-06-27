import { NativeModules, Platform } from 'react-native';

export type AndroidStepCounterStatus = {
  todaySteps: number;
  dateKey: string;
  isRunning: boolean;
  isSensorAvailable: boolean;
};

type AndroidStepCounterModuleContract = {
  start: () => Promise<AndroidStepCounterStatus>;
  getCurrent: () => Promise<AndroidStepCounterStatus>;
  stop: () => Promise<AndroidStepCounterStatus>;
};

const nativeModule = NativeModules.AndroidStepCounter as AndroidStepCounterModuleContract | undefined;

export const isAndroidNativeStepCounterAvailable = (): boolean => {
  return Platform.OS === 'android' && nativeModule !== undefined;
};

export const startAndroidNativeStepCounter = async (): Promise<AndroidStepCounterStatus> => {
  if (!nativeModule) {
    throw new Error('Android native step counter is not available.');
  }

  return await nativeModule.start();
};

export const getAndroidNativeStepCounterStatus = async (): Promise<AndroidStepCounterStatus> => {
  if (!nativeModule) {
    throw new Error('Android native step counter is not available.');
  }

  return await nativeModule.getCurrent();
};

export const stopAndroidNativeStepCounter = async (): Promise<AndroidStepCounterStatus> => {
  if (!nativeModule) {
    throw new Error('Android native step counter is not available.');
  }

  return await nativeModule.stop();
};
