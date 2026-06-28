package com.personal.pedometer

import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

class AndroidStepCounterModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "AndroidStepCounter"

  @ReactMethod
  fun start(promise: Promise) {
    try {
      val isSensorSupported = hasSupportedStepSensor()
      if (!isSensorSupported) {
        reactContext.getSharedPreferences(AndroidStepCounterService.PREFERENCES_NAME, Context.MODE_PRIVATE)
          .edit()
          .putBoolean(AndroidStepCounterService.KEY_SENSOR_AVAILABLE, false)
          .putBoolean(AndroidStepCounterService.KEY_RUNNING, false)
          .apply()
        promise.resolve(createStatusMap(isRunningOverride = false, isSensorAvailableOverride = false))
        return
      }

      val serviceIntent = Intent(reactContext, AndroidStepCounterService::class.java)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(serviceIntent)
      } else {
        reactContext.startService(serviceIntent)
      }

      reactContext.getSharedPreferences(AndroidStepCounterService.PREFERENCES_NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(AndroidStepCounterService.KEY_SENSOR_AVAILABLE, true)
        .putBoolean(AndroidStepCounterService.KEY_RUNNING, true)
        .apply()
      promise.resolve(createStatusMap(isRunningOverride = true, isSensorAvailableOverride = true))
    } catch (error: Exception) {
      promise.reject("ANDROID_STEP_COUNTER_START_FAILED", error)
    }
  }

  @ReactMethod
  fun getCurrent(promise: Promise) {
    try {
      promise.resolve(createStatusMap())
    } catch (error: Exception) {
      promise.reject("ANDROID_STEP_COUNTER_READ_FAILED", error)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      reactContext.stopService(Intent(reactContext, AndroidStepCounterService::class.java))
      promise.resolve(createStatusMap(isRunningOverride = false))
    } catch (error: Exception) {
      promise.reject("ANDROID_STEP_COUNTER_STOP_FAILED", error)
    }
  }

  private fun hasSupportedStepSensor(): Boolean {
    val sensorManager = reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    val stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    val stepDetector = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)

    return stepCounter != null || stepDetector != null
  }

  private fun createStatusMap(
    isRunningOverride: Boolean? = null,
    isSensorAvailableOverride: Boolean? = null
  ): WritableNativeMap {
    val preferences = reactContext.getSharedPreferences(AndroidStepCounterService.PREFERENCES_NAME, Context.MODE_PRIVATE)
    val todayDateKey = AndroidStepCounterService.getTodayDateKey()
    val storedDateKey = preferences.getString(AndroidStepCounterService.KEY_DATE, todayDateKey) ?: todayDateKey
    val todaySteps = if (storedDateKey == todayDateKey) {
      preferences.getInt(AndroidStepCounterService.KEY_TODAY_STEPS, 0)
    } else {
      0
    }
    val isRunning = isRunningOverride ?: preferences.getBoolean(AndroidStepCounterService.KEY_RUNNING, false)
    val isSensorAvailable = isSensorAvailableOverride
      ?: if (isRunning) {
        preferences.getBoolean(AndroidStepCounterService.KEY_SENSOR_AVAILABLE, hasSupportedStepSensor())
      } else {
        hasSupportedStepSensor()
      }

    return WritableNativeMap().apply {
      putInt("todaySteps", todaySteps)
      putString("dateKey", todayDateKey)
      putBoolean("isRunning", isRunning)
      putBoolean("isSensorAvailable", isSensorAvailable)
    }
  }
}
