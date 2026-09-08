import type { NativeStepHistory, StepHistoryStorage } from 'src/pedometer/contracts/step-history';
import type { RecordsByDateKey } from 'src/pedometer/types';

export const getNativeTodaySteps = (snapshot: NativeStepHistory, todayDateKey: string): number => {
  return snapshot.dateKey === todayDateKey
    ? snapshot.todaySteps
    : snapshot.dailySteps.find((dailySteps) => dailySteps.dateKey === todayDateKey)?.steps ?? 0;
};

export const mergeNativeStepHistory = (
  records: RecordsByDateKey,
  snapshot: NativeStepHistory,
  todayDateKey: string,
  dailyGoalSteps: number,
  updatedAtIso: string,
): RecordsByDateKey => {
  const nextRecords = { ...records };

  for (const dailySteps of [...snapshot.dailySteps, { dateKey: snapshot.dateKey, steps: snapshot.todaySteps }]) {
    const existingRecord = records[dailySteps.dateKey];
    nextRecords[dailySteps.dateKey] = {
      dateKey: dailySteps.dateKey,
      steps: dailySteps.steps,
      goalSteps: dailySteps.dateKey === todayDateKey
        ? dailyGoalSteps
        : existingRecord?.goalSteps ?? dailyGoalSteps,
      updatedAtIso,
    };
  }

  return nextRecords;
};

// One queue owns history reads and writes, including refresh and clear. A new
// tracking session invalidates native responses that were already in flight.
export class StepHistorySynchronizer {
  private records: RecordsByDateKey = {};
  private pendingOperation: Promise<unknown> = Promise.resolve();
  private session = 0;

  constructor(private readonly storage: StepHistoryStorage) {}

  beginSession(): number {
    this.session += 1;
    return this.session;
  }

  isCurrent(session: number): boolean {
    return session === this.session;
  }

  load(session: number): Promise<RecordsByDateKey | null> {
    return this.enqueue(async () => {
      if (!this.isCurrent(session)) return null;
      this.records = await this.storage.load();
      return this.isCurrent(session) ? this.records : null;
    });
  }

  update(
    session: number,
    transform: (records: RecordsByDateKey) => RecordsByDateKey,
  ): Promise<RecordsByDateKey | null> {
    return this.enqueue(async () => {
      if (!this.isCurrent(session)) return null;
      const nextRecords = transform(this.records);
      await this.storage.save(nextRecords);
      this.records = nextRecords;
      return this.isCurrent(session) ? nextRecords : null;
    });
  }

  private enqueue<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    const nextOperation = this.pendingOperation.then(operation, operation);
    this.pendingOperation = nextOperation;
    return nextOperation;
  }
}
