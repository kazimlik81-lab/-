import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

export type AppUpdateSynchronizationResult =
  | { status: 'disabled' }
  | { status: 'current' }
  | { status: 'reloading' }
  | { status: 'error'; message: string };

let synchronizationPromise: Promise<AppUpdateSynchronizationResult> | null = null;

const shouldSynchronizeAppUpdates = (): boolean => Platform.OS !== 'web' && Updates.isEnabled;

const getUpdateSynchronizationErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Не удалось проверить обновление приложения.';
};

const runAppUpdateSynchronization = async (): Promise<AppUpdateSynchronizationResult> => {
  if (!shouldSynchronizeAppUpdates()) {
    return { status: 'disabled' };
  }

  const updateCheckResult = await Updates.checkForUpdateAsync();

  if (!updateCheckResult.isAvailable && !updateCheckResult.isRollBackToEmbedded) {
    return { status: 'current' };
  }

  const updateFetchResult = await Updates.fetchUpdateAsync();

  if (updateFetchResult.isNew || updateFetchResult.isRollBackToEmbedded) {
    await Updates.reloadAsync();
    return { status: 'reloading' };
  }

  return { status: 'current' };
};

export const synchronizeAppUpdates = async (): Promise<AppUpdateSynchronizationResult> => {
  if (synchronizationPromise) {
    return await synchronizationPromise;
  }

  synchronizationPromise = (async (): Promise<AppUpdateSynchronizationResult> => {
    try {
      return await runAppUpdateSynchronization();
    } catch (error) {
      return {
        status: 'error',
        message: getUpdateSynchronizationErrorMessage(error),
      };
    } finally {
      synchronizationPromise = null;
    }
  })();

  return await synchronizationPromise;
};
