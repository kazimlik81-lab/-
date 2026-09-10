import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { AppUpdateSynchronizer } from 'src/pedometer/app-update-synchronizer';
import type { AppUpdateContext } from 'src/pedometer/contracts/app-updates';

export const createAppUpdateSynchronizer = (readContext: () => AppUpdateContext): AppUpdateSynchronizer => {
  return new AppUpdateSynchronizer({
    isEnabled: () => Platform.OS !== 'web' && Updates.isEnabled,
    isUpdatePending: () => Updates.latestContext.isUpdatePending,
    checkForUpdate: Updates.checkForUpdateAsync,
    fetchUpdate: Updates.fetchUpdateAsync,
    reload: Updates.reloadAsync,
  }, readContext);
};

export const watchPendingAppUpdates = (onPendingUpdate: () => void): { remove: () => void } => {
  return Updates.addUpdatesStateChangeListener(({ context }) => {
    if (context.isUpdatePending && !context.isRestarting) onPendingUpdate();
  });
};
