import { deepStrictEqual, equal, rejects } from 'node:assert/strict';
import { test } from 'node:test';

// Node's test runner resolves the emitted module from the test output directory.
import { getNativeTodaySteps, mergeNativeStepHistory, StepHistorySynchronizer } from '../src/pedometer/history-sync';
import type { NativeStepHistory } from 'src/pedometer/contracts/step-history';
import type { DailyRecord, RecordsByDateKey } from 'src/pedometer/types';

const updatedAtIso = '2026-09-08T10:00:00.000Z';
const todayDateKey = '2026-09-08';
const yesterdayDateKey = '2026-09-07';

const record = (dateKey: string, steps: number, goalSteps = 6000): DailyRecord => ({
  dateKey,
  steps,
  goalSteps,
  updatedAtIso,
});

const deferred = (): { promise: Promise<void>; resolve: () => void } => {
  let complete = (): void => { throw new Error('Deferred resolver has not been initialized.'); };
  const promise = new Promise<void>((resolve) => { complete = resolve; });
  return { promise, resolve: complete };
};

test('reopening imports completed native days and preserves their saved goals', () => {
  const existing: RecordsByDateKey = {
    [yesterdayDateKey]: record(yesterdayDateKey, 1900, 5000),
    [todayDateKey]: record(todayDateKey, 1000, 6000),
    '2026-09-01': record('2026-09-01', 4200, 4000),
  };
  const snapshot: NativeStepHistory = {
    dateKey: todayDateKey,
    todaySteps: 3000,
    dailySteps: [
      { dateKey: '2026-09-06', steps: 7100 },
      { dateKey: yesterdayDateKey, steps: 8650 },
      { dateKey: todayDateKey, steps: 3000 },
    ],
  };

  const merged = mergeNativeStepHistory(existing, snapshot, todayDateKey, 8000, updatedAtIso);

  deepStrictEqual(merged[yesterdayDateKey], record(yesterdayDateKey, 8650, 5000));
  deepStrictEqual(merged[todayDateKey], record(todayDateKey, 3000, 8000));
  deepStrictEqual(merged['2026-09-06'], record('2026-09-06', 7100, 8000));
  deepStrictEqual(merged['2026-09-01'], existing['2026-09-01']);
  equal(existing[yesterdayDateKey].steps, 1900);
});

test('a snapshot crossing midnight stays on its native date and is not displayed as today', () => {
  const snapshot: NativeStepHistory = {
    dateKey: yesterdayDateKey,
    todaySteps: 8650,
    dailySteps: [{ dateKey: yesterdayDateKey, steps: 8650 }],
  };
  const merged = mergeNativeStepHistory({}, snapshot, todayDateKey, 8000, updatedAtIso);

  equal(merged[yesterdayDateKey].steps, 8650);
  equal(merged[todayDateKey], undefined);
  equal(getNativeTodaySteps(snapshot, todayDateKey), 0);
});

test('the displayed current count comes from the native current-day total', () => {
  const snapshot: NativeStepHistory = {
    dateKey: todayDateKey,
    todaySteps: 3012,
    dailySteps: [{ dateKey: yesterdayDateKey, steps: 8650 }],
  };
  equal(getNativeTodaySteps(snapshot, todayDateKey), 3012);
});

test('overlapping updates merge against the last committed history without lost days', async () => {
  const firstWriteStarted = deferred();
  const releaseFirstWrite = deferred();
  const writes: RecordsByDateKey[] = [];
  let stored: RecordsByDateKey = {};
  const synchronizer = new StepHistorySynchronizer({
    load: async () => stored,
    save: async (records) => {
      writes.push(records);
      if (writes.length === 1) {
        firstWriteStarted.resolve();
        await releaseFirstWrite.promise;
      }
      stored = records;
    },
  });
  const session = synchronizer.beginSession();
  const first = synchronizer.update(session, (records) => ({ ...records, [yesterdayDateKey]: record(yesterdayDateKey, 8650) }));
  const second = synchronizer.update(session, (records) => ({ ...records, [todayDateKey]: record(todayDateKey, 3000) }));

  await firstWriteStarted.promise;
  equal(writes.length, 1);
  releaseFirstWrite.resolve();
  await Promise.all([first, second]);
  equal(stored[yesterdayDateKey].steps, 8650);
  equal(stored[todayDateKey].steps, 3000);
});

test('refresh waits for an in-flight write and rejects late results from the old session', async () => {
  const writeStarted = deferred();
  const releaseWrite = deferred();
  let stored: RecordsByDateKey = {};
  const synchronizer = new StepHistorySynchronizer({
    load: async () => stored,
    save: async (records) => {
      writeStarted.resolve();
      await releaseWrite.promise;
      stored = records;
    },
  });
  const oldSession = synchronizer.beginSession();
  const pendingWrite = synchronizer.update(oldSession, () => ({ [todayDateKey]: record(todayDateKey, 3000) }));
  await writeStarted.promise;
  const newSession = synchronizer.beginSession();
  const refresh = synchronizer.load(newSession);
  const stalePoll = synchronizer.update(oldSession, () => ({ [todayDateKey]: record(todayDateKey, 1000) }));
  releaseWrite.resolve();

  equal(await pendingWrite, null);
  equal((await refresh)?.[todayDateKey].steps, 3000);
  equal(await stalePoll, null);
  equal(stored[todayDateKey].steps, 3000);
});

test('clear removes old days after an in-flight write, keeps today, and blocks stale restoration', async () => {
  const writeStarted = deferred();
  const releaseWrite = deferred();
  let writeCount = 0;
  let stored: RecordsByDateKey = {
    [yesterdayDateKey]: record(yesterdayDateKey, 8650),
    [todayDateKey]: record(todayDateKey, 3000),
  };
  const synchronizer = new StepHistorySynchronizer({
    load: async () => stored,
    save: async (records) => {
      writeCount += 1;
      if (writeCount === 1) {
        writeStarted.resolve();
        await releaseWrite.promise;
      }
      stored = records;
    },
  });
  const oldSession = synchronizer.beginSession();
  await synchronizer.load(oldSession);
  const oldPoll = synchronizer.update(oldSession, (records) => ({ ...records, [todayDateKey]: record(todayDateKey, 3010) }));
  await writeStarted.promise;
  const clearSession = synchronizer.beginSession();
  const afterNativeClear: NativeStepHistory = { dateKey: todayDateKey, todaySteps: 3012, dailySteps: [] };
  const clear = synchronizer.update(clearSession, () => mergeNativeStepHistory({}, afterNativeClear, todayDateKey, 6000, updatedAtIso));
  const stalePoll = synchronizer.update(oldSession, (records) => ({ ...records, [yesterdayDateKey]: record(yesterdayDateKey, 8650) }));
  releaseWrite.resolve();

  equal(await oldPoll, null);
  deepStrictEqual(await clear, { [todayDateKey]: record(todayDateKey, 3012) });
  equal(await stalePoll, null);
  deepStrictEqual(await synchronizer.load(clearSession), { [todayDateKey]: record(todayDateKey, 3012) });
  equal(getNativeTodaySteps(afterNativeClear, todayDateKey), 3012);
});

test('failed persistence is reported and a later sync can still save', async () => {
  let shouldFail = true;
  let stored: RecordsByDateKey = {};
  const synchronizer = new StepHistorySynchronizer({
    load: async () => stored,
    save: async (records) => {
      if (shouldFail) throw new Error('storage full');
      stored = records;
    },
  });
  const session = synchronizer.beginSession();
  await rejects(synchronizer.update(session, () => ({ [todayDateKey]: record(todayDateKey, 3000) })), /storage full/);
  shouldFail = false;
  await synchronizer.update(session, () => ({ [todayDateKey]: record(todayDateKey, 3012) }));
  equal(stored[todayDateKey].steps, 3012);
});
