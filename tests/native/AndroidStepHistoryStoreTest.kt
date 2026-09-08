package com.personal.pedometer

import android.content.SharedPreferences

private const val HISTORY_TODAY = "2026-09-04"
private const val HISTORY_YESTERDAY = "2026-09-03"
private const val HISTORY_TOMORROW = "2026-09-05"

private class InMemorySharedPreferences(initialValues: Map<String, Any> = emptyMap()) : SharedPreferences {
  private val values = initialValues.toMutableMap()
  private val listeners = mutableSetOf<SharedPreferences.OnSharedPreferenceChangeListener>()
  val committedSnapshots = mutableListOf<Map<String, Any>>()

  override fun getAll(): MutableMap<String, *> = values.toMutableMap()
  override fun contains(key: String): Boolean = values.containsKey(key)

  override fun getString(key: String, defValue: String?): String? {
    val value = values[key] ?: return defValue
    check(value is String) { "Preference $key is not a string" }
    return value
  }

  override fun getStringSet(key: String, defValues: MutableSet<String>?): MutableSet<String>? {
    val value = values[key] ?: return defValues
    check(value is Set<*>) { "Preference $key is not a set" }
    val strings = mutableSetOf<String>()
    for (element in value) {
      check(element is String) { "Preference $key contains a non-string value" }
      strings.add(element)
    }
    return strings
  }

  override fun getInt(key: String, defValue: Int): Int {
    val value = values[key] ?: return defValue
    check(value is Int) { "Preference $key is not an integer" }
    return value
  }

  override fun getLong(key: String, defValue: Long): Long {
    val value = values[key] ?: return defValue
    check(value is Long) { "Preference $key is not a long" }
    return value
  }

  override fun getFloat(key: String, defValue: Float): Float {
    val value = values[key] ?: return defValue
    check(value is Float) { "Preference $key is not a float" }
    return value
  }

  override fun getBoolean(key: String, defValue: Boolean): Boolean {
    val value = values[key] ?: return defValue
    check(value is Boolean) { "Preference $key is not a boolean" }
    return value
  }

  override fun edit(): SharedPreferences.Editor = Editor()

  override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) {
    listeners.add(listener)
  }

  override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener) {
    listeners.remove(listener)
  }

  private inner class Editor : SharedPreferences.Editor {
    private val pendingValues = linkedMapOf<String, Any?>()
    private var clearRequested = false

    override fun putString(key: String, value: String?): SharedPreferences.Editor = apply {
      pendingValues[key] = value
    }

    override fun putStringSet(key: String, values: MutableSet<String>?): SharedPreferences.Editor = apply {
      pendingValues[key] = values?.toSet()
    }

    override fun putInt(key: String, value: Int): SharedPreferences.Editor = apply {
      pendingValues[key] = value
    }

    override fun putLong(key: String, value: Long): SharedPreferences.Editor = apply {
      pendingValues[key] = value
    }

    override fun putFloat(key: String, value: Float): SharedPreferences.Editor = apply {
      pendingValues[key] = value
    }

    override fun putBoolean(key: String, value: Boolean): SharedPreferences.Editor = apply {
      pendingValues[key] = value
    }

    override fun remove(key: String): SharedPreferences.Editor = apply {
      pendingValues[key] = null
    }

    override fun clear(): SharedPreferences.Editor = apply {
      clearRequested = true
    }

    override fun commit(): Boolean {
      apply()
      return true
    }

    override fun apply() {
      val changedKeys = pendingValues.keys.toSet()
      if (clearRequested) values.clear()
      for ((key, value) in pendingValues) {
        if (value == null) values.remove(key) else values[key] = value
      }
      committedSnapshots.add(values.toMap())
      pendingValues.clear()
      clearRequested = false
      for (key in changedKeys) {
        for (listener in listeners) listener.onSharedPreferenceChanged(this@InMemorySharedPreferences, key)
      }
    }
  }
}

private fun legacyPreferences(dateKey: String, steps: Int): InMemorySharedPreferences = InMemorySharedPreferences(
  mapOf(
    AndroidStepCounterService.KEY_DATE to dateKey,
    AndroidStepCounterService.KEY_TODAY_STEPS to steps,
    AndroidStepCounterService.KEY_LAST_SENSOR_STEPS to 25000,
    AndroidStepCounterService.KEY_RUNNING to true
  )
)

private fun saveHistoryEvent(preferences: SharedPreferences, dateKey: String, steps: Int) {
  val editor = preferences.edit()
  AndroidStepHistoryStore(preferences).recordSteps(editor, dateKey, steps)
  editor.putString(AndroidStepCounterService.KEY_DATE, dateKey)
    .putInt(AndroidStepCounterService.KEY_TODAY_STEPS, steps)
    .apply()
}

private fun historyCase(name: String, test: () -> Unit) {
  test()
  println("PASS $name")
}

object AndroidStepHistoryStoreTest {
  @JvmStatic
  fun main(arguments: Array<String>) {
    historyCase("empty native history reads without modifying preferences") {
      val preferences = InMemorySharedPreferences()
      check(AndroidStepHistoryStore(preferences).readDailySteps().isEmpty())
      check(preferences.committedSnapshots.isEmpty())
    }

    historyCase("first read exposes legacy current day without a write") {
      val preferences = legacyPreferences(HISTORY_YESTERDAY, 600)
      check(AndroidStepHistoryStore(preferences).readDailySteps() == mapOf(HISTORY_YESTERDAY to 600))
      check(preferences.committedSnapshots.isEmpty())
    }

    historyCase("first new-day event archives yesterday atomically with current sensor state") {
      val preferences = legacyPreferences(HISTORY_YESTERDAY, 600)
      val history = AndroidStepHistoryStore(preferences)
      val editor = preferences.edit()
      history.recordSteps(editor, HISTORY_TODAY, 8)
      editor.putString(AndroidStepCounterService.KEY_DATE, HISTORY_TODAY)
        .putInt(AndroidStepCounterService.KEY_TODAY_STEPS, 8)
        .putInt(AndroidStepCounterService.KEY_LAST_SENSOR_STEPS, 25008)
      check(preferences.committedSnapshots.isEmpty())
      check(history.readDailySteps() == mapOf(HISTORY_YESTERDAY to 600))
      editor.apply()
      check(preferences.committedSnapshots.size == 1)
      val committedSnapshot = preferences.committedSnapshots.single()
      check(committedSnapshot[AndroidStepCounterService.KEY_DATE] == HISTORY_TODAY)
      check(committedSnapshot[AndroidStepCounterService.KEY_TODAY_STEPS] == 8)
      check(committedSnapshot[AndroidStepCounterService.KEY_LAST_SENSOR_STEPS] == 25008)
      check(AndroidStepHistoryStore(InMemorySharedPreferences(committedSnapshot)).readDailySteps() ==
        mapOf(HISTORY_YESTERDAY to 600, HISTORY_TODAY to 8))
    }

    historyCase("first same-day event replaces the legacy daily count once") {
      val preferences = legacyPreferences(HISTORY_TODAY, 600)
      saveHistoryEvent(preferences, HISTORY_TODAY, 615)
      check(AndroidStepHistoryStore(preferences).readDailySteps() == mapOf(HISTORY_TODAY to 615))
      check(preferences.committedSnapshots.size == 1)
    }

    historyCase("several background days survive recreation without any intervening history reads") {
      val preferences = legacyPreferences(HISTORY_YESTERDAY, 100)
      saveHistoryEvent(preferences, HISTORY_YESTERDAY, 600)
      saveHistoryEvent(preferences, HISTORY_TODAY, 8)
      saveHistoryEvent(preferences, HISTORY_TODAY, 900)
      saveHistoryEvent(preferences, HISTORY_TOMORROW, 12)
      check(AndroidStepHistoryStore(preferences).readDailySteps() ==
        mapOf(HISTORY_YESTERDAY to 600, HISTORY_TODAY to 900, HISTORY_TOMORROW to 12))
    }

    historyCase("clear before today's first event never restores yesterday's legacy history") {
      val preferences = legacyPreferences(HISTORY_YESTERDAY, 600)
      AndroidStepHistoryStore(preferences).clearHistory(HISTORY_TODAY)
      check(AndroidStepHistoryStore(preferences).readDailySteps().isEmpty())
      check(preferences.getString(AndroidStepCounterService.KEY_DATE, null) == HISTORY_YESTERDAY)
      check(preferences.getInt(AndroidStepCounterService.KEY_TODAY_STEPS, -1) == 600)
      saveHistoryEvent(preferences, HISTORY_TODAY, 8)
      check(AndroidStepHistoryStore(preferences).readDailySteps() == mapOf(HISTORY_TODAY to 8))
    }

    historyCase("clear on a legacy current day preserves today's counter and later increments") {
      val preferences = legacyPreferences(HISTORY_TODAY, 600)
      AndroidStepHistoryStore(preferences).clearHistory(HISTORY_TODAY)
      check(AndroidStepHistoryStore(preferences).readDailySteps() == mapOf(HISTORY_TODAY to 600))
      check(preferences.getInt(AndroidStepCounterService.KEY_LAST_SENSOR_STEPS, -1) == 25000)
      check(preferences.getBoolean(AndroidStepCounterService.KEY_RUNNING, false))
      saveHistoryEvent(preferences, HISTORY_TODAY, 614)
      check(AndroidStepHistoryStore(preferences).readDailySteps() == mapOf(HISTORY_TODAY to 614))
    }

    historyCase("delayed previous-day events after clearing update sensor state without restoring history") {
      val preferences = legacyPreferences(HISTORY_YESTERDAY, 600)
      AndroidStepHistoryStore(preferences).clearHistory(HISTORY_TODAY)
      saveHistoryEvent(preferences, HISTORY_YESTERDAY, 608)
      check(AndroidStepHistoryStore(preferences).readDailySteps().isEmpty())
      check(preferences.getString(AndroidStepCounterService.KEY_DATE, null) == HISTORY_YESTERDAY)
      check(preferences.getInt(AndroidStepCounterService.KEY_TODAY_STEPS, -1) == 608)
      saveHistoryEvent(preferences, HISTORY_TODAY, 8)
      check(AndroidStepHistoryStore(preferences).readDailySteps() == mapOf(HISTORY_TODAY to 8))
      saveHistoryEvent(preferences, HISTORY_TOMORROW, 2)
      check(AndroidStepHistoryStore(preferences).readDailySteps() ==
        mapOf(HISTORY_TODAY to 8, HISTORY_TOMORROW to 2))
    }

    historyCase("clear removes older days in one commit and preserves today's native state") {
      val preferences = legacyPreferences(HISTORY_YESTERDAY, 600)
      saveHistoryEvent(preferences, HISTORY_TODAY, 900)
      val previousCommitCount = preferences.committedSnapshots.size
      val sensorStateBeforeClear = preferences.all.filterKeys { !it.startsWith("daily_steps") }
      AndroidStepHistoryStore(preferences).clearHistory(HISTORY_TODAY)
      check(preferences.committedSnapshots.size == previousCommitCount + 1)
      val clearedSnapshot = preferences.committedSnapshots.last()
      check(AndroidStepHistoryStore(InMemorySharedPreferences(clearedSnapshot)).readDailySteps() ==
        mapOf(HISTORY_TODAY to 900))
      check(preferences.all.filterKeys { !it.startsWith("daily_steps") } == sensorStateBeforeClear)
      saveHistoryEvent(preferences, HISTORY_TODAY, 920)
      check(AndroidStepHistoryStore(preferences).readDailySteps() == mapOf(HISTORY_TODAY to 920))
    }

    historyCase("repeated clears without a current-day record remain empty after recreation") {
      val preferences = legacyPreferences(HISTORY_YESTERDAY, 600)
      saveHistoryEvent(preferences, HISTORY_YESTERDAY, 700)
      AndroidStepHistoryStore(preferences).clearHistory(HISTORY_TODAY)
      AndroidStepHistoryStore(preferences).clearHistory(HISTORY_TODAY)
      check(AndroidStepHistoryStore(preferences).readDailySteps().isEmpty())
      saveHistoryEvent(preferences, HISTORY_TODAY, 1)
      check(AndroidStepHistoryStore(preferences).readDailySteps() == mapOf(HISTORY_TODAY to 1))
    }
    println("All 10 native step-history regression checks passed.")
  }
}
