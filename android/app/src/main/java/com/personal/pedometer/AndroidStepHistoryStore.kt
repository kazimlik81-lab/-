package com.personal.pedometer

import android.content.SharedPreferences

class AndroidStepHistoryStore(private val preferences: SharedPreferences) {
  fun readDailySteps(): Map<String, Int> {
    val dailySteps = sortedMapOf<String, Int>()
    for ((key, value) in preferences.all) {
      if (key.startsWith(DAILY_STEPS_PREFIX)) {
        if (value !is Int || value < 0) {
          throw IllegalStateException("Invalid saved step count for $key")
        }
        dailySteps[key.removePrefix(DAILY_STEPS_PREFIX)] = value
      }
    }

    if (!preferences.getBoolean(KEY_HISTORY_INITIALIZED, false)) {
      val storedDate = preferences.getString(AndroidStepCounterService.KEY_DATE, null)
      if (storedDate != null) {
        dailySteps[storedDate] = preferences.getInt(AndroidStepCounterService.KEY_TODAY_STEPS, 0)
      }
    }
    return dailySteps
  }

  fun recordSteps(editor: SharedPreferences.Editor, dateKey: String, steps: Int) {
    if (!preferences.getBoolean(KEY_HISTORY_INITIALIZED, false)) {
      val storedDate = preferences.getString(AndroidStepCounterService.KEY_DATE, null)
      if (storedDate != null) {
        editor.putInt(
          DAILY_STEPS_PREFIX + storedDate,
          preferences.getInt(AndroidStepCounterService.KEY_TODAY_STEPS, 0)
        )
      }
    }
    editor.putBoolean(KEY_HISTORY_INITIALIZED, true)
    val historyStartDate = preferences.getString(KEY_HISTORY_START_DATE, null)
    if (historyStartDate == null || dateKey >= historyStartDate) {
      editor.putInt(DAILY_STEPS_PREFIX + dateKey, steps)
    }
  }

  fun clearHistory(todayDateKey: String) {
    val todaySteps = readDailySteps()[todayDateKey]
    val editor = preferences.edit()
    for (key in preferences.all.keys) {
      if (key.startsWith(DAILY_STEPS_PREFIX)) {
        editor.remove(key)
      }
    }
    if (todaySteps != null) {
      editor.putInt(DAILY_STEPS_PREFIX + todayDateKey, todaySteps)
    }
    editor.putString(KEY_HISTORY_START_DATE, todayDateKey)
      .putBoolean(KEY_HISTORY_INITIALIZED, true)
      .apply()
  }

  companion object {
    private const val DAILY_STEPS_PREFIX = "daily_steps:"
    private const val KEY_HISTORY_INITIALIZED = "daily_steps_initialized"
    private const val KEY_HISTORY_START_DATE = "daily_steps_start_date"
  }
}
