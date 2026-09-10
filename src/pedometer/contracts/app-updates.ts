export type AppUpdateSynchronizationResult =
  | { status: 'disabled' }
  | { status: 'current' }
  | { status: 'deferred' }
  | { status: 'reloading' }
  | { status: 'error'; message: string };

export type AppUpdateSynchronizationInput = {
  checkForUpdate: boolean;
};

export type AppUpdateContext = {
  isForeground: boolean;
  canReload: boolean;
};

export type AppUpdateClient = {
  isEnabled: () => boolean;
  isUpdatePending: () => boolean;
  checkForUpdate: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded: boolean }>;
  fetchUpdate: () => Promise<{ isNew: boolean; isRollBackToEmbedded: boolean }>;
  reload: () => Promise<void>;
};
