import type {
  AppUpdateClient,
  AppUpdateContext,
  AppUpdateSynchronizationInput,
  AppUpdateSynchronizationResult,
} from 'src/pedometer/contracts/app-updates';

export class AppUpdateSynchronizer {
  private synchronizationPromise: Promise<AppUpdateSynchronizationResult> | null = null;
  private hasDownloadedUpdate = false;
  private isReloading = false;

  constructor(
    private readonly client: AppUpdateClient,
    private readonly readContext: () => AppUpdateContext,
  ) {}

  synchronize(input: AppUpdateSynchronizationInput): Promise<AppUpdateSynchronizationResult> {
    if (this.synchronizationPromise) return this.synchronizationPromise;
    if (!input.checkForUpdate && !this.hasPendingUpdate()) {
      return Promise.resolve({ status: this.client.isEnabled() ? 'current' : 'disabled' });
    }

    this.synchronizationPromise = Promise.resolve().then(() => this.run(input)).catch((error: unknown): AppUpdateSynchronizationResult => {
      this.isReloading = false;
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Не удалось проверить обновление приложения.',
      };
    }).finally(() => {
      this.synchronizationPromise = null;
    });

    return this.synchronizationPromise;
  }

  private hasPendingUpdate(): boolean {
    return this.hasDownloadedUpdate || this.client.isUpdatePending();
  }

  private async run(input: AppUpdateSynchronizationInput): Promise<AppUpdateSynchronizationResult> {
    if (!this.client.isEnabled()) return { status: 'disabled' };
    if (this.isReloading) return { status: 'reloading' };
    if (!this.readContext().isForeground) return { status: 'deferred' };
    if (this.hasPendingUpdate()) return await this.applyPendingUpdate();
    if (!input.checkForUpdate) return { status: 'current' };

    try {
      const checkResult = await this.client.checkForUpdate();
      // The native launch check may have completed while our request was in flight.
      if (this.hasPendingUpdate()) return await this.applyPendingUpdate();
      if (!checkResult.isAvailable && !checkResult.isRollBackToEmbedded) return { status: 'current' };
      if (!this.readContext().isForeground) return { status: 'deferred' };

      const fetchResult = await this.client.fetchUpdate();
      this.hasDownloadedUpdate = fetchResult.isNew || fetchResult.isRollBackToEmbedded;
    } catch (error) {
      // A downloaded update can still be applied after connectivity is lost.
      if (!this.isReloading && this.hasPendingUpdate()) return await this.applyPendingUpdate();
      throw error;
    }

    return this.hasPendingUpdate() ? await this.applyPendingUpdate() : { status: 'current' };
  }

  private async applyPendingUpdate(): Promise<AppUpdateSynchronizationResult> {
    const context = this.readContext();
    if (!context.isForeground || !context.canReload) return { status: 'deferred' };

    this.isReloading = true;
    await this.client.reload();
    return { status: 'reloading' };
  }
}
