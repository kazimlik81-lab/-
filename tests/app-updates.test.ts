import { deepStrictEqual, equal } from 'node:assert/strict';
import { test } from 'node:test';

// Node resolves the emitted module from the test output directory.
import { AppUpdateSynchronizer } from '../src/pedometer/app-update-synchronizer';
import type { AppUpdateClient, AppUpdateContext } from 'src/pedometer/contracts/app-updates';

const checkForUpdate = { checkForUpdate: true };
const applyPendingOnly = { checkForUpdate: false };
const updateAvailable = { isAvailable: true, isRollBackToEmbedded: false };
const noUpdateAvailable = { isAvailable: false, isRollBackToEmbedded: false };
const newUpdate = { isNew: true, isRollBackToEmbedded: false };

const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
  let complete = (_value: T): void => { throw new Error('Deferred resolver has not been initialized.'); };
  const promise = new Promise<T>((resolve) => { complete = resolve; });
  return { promise, resolve: complete };
};

const fixture = () => {
  const calls = { checks: 0, downloads: 0, reloads: 0 };
  const context: AppUpdateContext = { isForeground: true, canReload: true };
  const client: AppUpdateClient = {
    isEnabled: () => true,
    isUpdatePending: () => false,
    checkForUpdate: () => { calls.checks += 1; return Promise.resolve(updateAvailable); },
    fetchUpdate: () => { calls.downloads += 1; return Promise.resolve(newUpdate); },
    reload: () => { calls.reloads += 1; return Promise.resolve(); },
  };
  return { calls, context, client, synchronizer: new AppUpdateSynchronizer(client, () => context) };
};

test('disabled updates do not check, download, or reload', async () => {
  const { client, calls, synchronizer } = fixture();
  client.isEnabled = () => false;
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'disabled');
  deepStrictEqual(calls, { checks: 0, downloads: 0, reloads: 0 });
});

test('an up-to-date app does not download or reload', async () => {
  const { client, calls, synchronizer } = fixture();
  client.checkForUpdate = () => Promise.resolve(noUpdateAvailable);
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'current');
  equal(calls.downloads, 0);
  equal(calls.reloads, 0);
});

test('a compatible update is checked, downloaded, and applied once', async () => {
  const { calls, synchronizer } = fixture();
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'reloading');
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'reloading');
  deepStrictEqual(calls, { checks: 1, downloads: 1, reloads: 1 });
});

test('an update downloaded by the native launcher applies without another network request', async () => {
  const { client, calls, synchronizer } = fixture();
  client.isUpdatePending = () => true;
  client.checkForUpdate = () => Promise.reject(new Error('Offline'));
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'reloading');
  deepStrictEqual(calls, { checks: 0, downloads: 0, reloads: 1 });
});

test('rollback to the embedded bundle is downloaded and applied', async () => {
  const { client, calls, synchronizer } = fixture();
  client.checkForUpdate = () => Promise.resolve({ isAvailable: false, isRollBackToEmbedded: true });
  client.fetchUpdate = () => Promise.resolve({ isNew: false, isRollBackToEmbedded: true });
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'reloading');
  equal(calls.reloads, 1);
});

test('a server returning no new bundle after the check does not reload', async () => {
  const { client, calls, synchronizer } = fixture();
  client.fetchUpdate = () => Promise.resolve({ isNew: false, isRollBackToEmbedded: false });
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'current');
  equal(calls.reloads, 0);
});

test('background interval ticks do not use the network or apply pending updates', async () => {
  const { client, context, calls, synchronizer } = fixture();
  context.isForeground = false;
  client.isUpdatePending = () => true;
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'deferred');
  deepStrictEqual(calls, { checks: 0, downloads: 0, reloads: 0 });
});

test('a download completed after backgrounding waits for foreground and applies without redownloading', async () => {
  const { client, context, calls, synchronizer } = fixture();
  client.fetchUpdate = () => {
    calls.downloads += 1;
    context.isForeground = false;
    return Promise.resolve(newUpdate);
  };
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'deferred');
  equal(calls.reloads, 0);
  context.isForeground = true;
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'reloading');
  deepStrictEqual(calls, { checks: 1, downloads: 1, reloads: 1 });
});

test('backgrounding during the availability check prevents starting a download', async () => {
  const { client, context, calls, synchronizer } = fixture();
  client.checkForUpdate = () => {
    context.isForeground = false;
    return Promise.resolve(updateAvailable);
  };
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'deferred');
  equal(calls.downloads, 0);
  equal(calls.reloads, 0);
});

test('editing or using the food camera defers a downloaded update until the screen is safe', async () => {
  const { context, calls, synchronizer } = fixture();
  context.canReload = false;
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'deferred');
  equal(calls.reloads, 0);
  context.canReload = true;
  equal((await synchronizer.synchronize(applyPendingOnly)).status, 'reloading');
  deepStrictEqual(calls, { checks: 1, downloads: 1, reloads: 1 });
});

test('screen navigation without a pending update does not check the server', async () => {
  const { calls, synchronizer } = fixture();
  equal((await synchronizer.synchronize(applyPendingOnly)).status, 'current');
  deepStrictEqual(calls, { checks: 0, downloads: 0, reloads: 0 });
});

test('a pending-only navigation event cannot suppress a simultaneous foreground check', async () => {
  const { calls, synchronizer } = fixture();
  const navigation = synchronizer.synchronize(applyPendingOnly);
  const foreground = synchronizer.synchronize(checkForUpdate);
  equal((await navigation).status, 'current');
  equal((await foreground).status, 'reloading');
  deepStrictEqual(calls, { checks: 1, downloads: 1, reloads: 1 });
});

test('concurrent foreground, interval, and native events share one operation', async () => {
  const { client, calls, synchronizer } = fixture();
  const check = deferred<typeof updateAvailable>();
  client.checkForUpdate = () => { calls.checks += 1; return check.promise; };
  const first = synchronizer.synchronize(checkForUpdate);
  const second = synchronizer.synchronize(checkForUpdate);
  const nativeEvent = synchronizer.synchronize(applyPendingOnly);
  equal(first, second);
  equal(first, nativeEvent);
  check.resolve(updateAvailable);
  const results = await Promise.all([first, second, nativeEvent]);
  deepStrictEqual(results.map((result) => result.status), ['reloading', 'reloading', 'reloading']);
  deepStrictEqual(calls, { checks: 1, downloads: 1, reloads: 1 });
});

test('an offline check reports the error and a later foreground attempt can succeed', async () => {
  const { client, calls, synchronizer } = fixture();
  client.checkForUpdate = () => Promise.reject(new Error('Offline'));
  deepStrictEqual(await synchronizer.synchronize(checkForUpdate), { status: 'error', message: 'Offline' });
  client.checkForUpdate = () => Promise.resolve(updateAvailable);
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'reloading');
  equal(calls.reloads, 1);
});

test('a failed download leaves the current app running and can be retried', async () => {
  const { client, calls, synchronizer } = fixture();
  client.fetchUpdate = () => Promise.reject(new Error('Download interrupted'));
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'error');
  equal(calls.reloads, 0);
  client.fetchUpdate = () => Promise.resolve(newUpdate);
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'reloading');
  equal(calls.checks, 2);
});

test('a reload failure retains the downloaded bundle and retries without the network', async () => {
  const { client, calls, synchronizer } = fixture();
  client.reload = () => { calls.reloads += 1; return Promise.reject(new Error('Reload failed')); };
  deepStrictEqual(await synchronizer.synchronize(checkForUpdate), { status: 'error', message: 'Reload failed' });
  client.reload = () => { calls.reloads += 1; return Promise.resolve(); };
  equal((await synchronizer.synchronize(applyPendingOnly)).status, 'reloading');
  deepStrictEqual(calls, { checks: 1, downloads: 1, reloads: 2 });
});

test('a native download that finishes during a failed network check still applies', async () => {
  const { client, calls, synchronizer } = fixture();
  client.checkForUpdate = () => {
    client.isUpdatePending = () => true;
    return Promise.reject(new Error('Offline'));
  };
  equal((await synchronizer.synchronize(checkForUpdate)).status, 'reloading');
  equal(calls.downloads, 0);
  equal(calls.reloads, 1);
});
