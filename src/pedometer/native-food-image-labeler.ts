import { NativeModules, Platform } from 'react-native';

export type AndroidFoodImageLabel = {
  confidence: number;
  index: number;
  text: string;
};

type AndroidFoodImageLabelerModuleContract = {
  recognize: (base64Jpeg: string) => Promise<AndroidFoodImageLabel[]>;
};

const nativeModule = NativeModules.AndroidFoodImageLabeler as AndroidFoodImageLabelerModuleContract | undefined;

export const isAndroidNativeFoodImageLabelerAvailable = (): boolean => {
  return Platform.OS === 'android' && typeof nativeModule?.recognize === 'function';
};

export const recognizeAndroidFoodImageLabels = async (base64Jpeg: string): Promise<AndroidFoodImageLabel[]> => {
  if (!isAndroidNativeFoodImageLabelerAvailable() || !nativeModule) {
    throw new Error('Локальная Android-модель анализа еды недоступна в этой сборке.');
  }

  return nativeModule.recognize(base64Jpeg);
};
