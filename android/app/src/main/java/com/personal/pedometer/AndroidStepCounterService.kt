package com.personal.pedometer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.max

class AndroidStepCounterService : Service(), SensorEventListener {
  private lateinit var sensorManager: SensorManager
  private var activeSensor: Sensor? = null
  private var hasReceivedStepCounterEvent = false
  private var wasRunningBeforeCreate = false
  private var lastNotificationSteps: Int = -1

  override fun onCreate() {
    super.onCreate()
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    wasRunningBeforeCreate = getPreferences().getBoolean(KEY_RUNNING, false)
    startAsForeground()
    registerStepSensor()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val isRegistered = activeSensor != null
    storeRunningState(isRegistered)
    return if (isRegistered) START_STICKY else START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    sensorManager.unregisterListener(this)
    storeRunningState(false)
    super.onDestroy()
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun onSensorChanged(event: SensorEvent) {
    when (event.sensor.type) {
      Sensor.TYPE_STEP_COUNTER -> handleStepCounterEvent(event.values.firstOrNull()?.toInt() ?: return)
      Sensor.TYPE_STEP_DETECTOR -> handleStepDetectorEvent()
    }
  }

  private fun registerStepSensor() {
    val stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    val stepDetector = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
    activeSensor = stepCounter ?: stepDetector

    if (activeSensor == null) {
      getPreferences().edit()
        .putBoolean(KEY_SENSOR_AVAILABLE, false)
        .putBoolean(KEY_RUNNING, false)
        .apply()
      updateNotification(0)
      stopSelf()
      return
    }

    val didRegister = sensorManager.registerListener(this, activeSensor, SensorManager.SENSOR_DELAY_NORMAL)

    if (!didRegister) {
      activeSensor = null
      getPreferences().edit()
        .putBoolean(KEY_SENSOR_AVAILABLE, false)
        .putBoolean(KEY_RUNNING, false)
        .apply()
      updateNotification(0)
      stopSelf()
      return
    }

    getPreferences().edit()
      .putBoolean(KEY_SENSOR_AVAILABLE, true)
      .putBoolean(KEY_RUNNING, true)
      .apply()
  }

  private fun handleStepCounterEvent(totalSensorSteps: Int) {
    val preferences = getPreferences()
    val todayDateKey = getTodayDateKey()
    val storedDateKey = preferences.getString(KEY_DATE, null)
    val storedSteps = preferences.getInt(KEY_TODAY_STEPS, 0)
    var baselineSteps = preferences.getInt(KEY_BASELINE_STEPS, -1)

    if (storedDateKey != todayDateKey) {
      val canContinueFromPreviousSensorValue = storedDateKey != null && (hasReceivedStepCounterEvent || wasRunningBeforeCreate)
      baselineSteps = if (canContinueFromPreviousSensorValue) {
        preferences.getInt(KEY_LAST_SENSOR_STEPS, totalSensorSteps)
      } else {
        totalSensorSteps
      }
    }

    if (baselineSteps < 0) {
      baselineSteps = max(0, totalSensorSteps - storedSteps)
    }

    val todaySteps = max(0, totalSensorSteps - baselineSteps)
    preferences.edit()
      .putString(KEY_DATE, todayDateKey)
      .putInt(KEY_BASELINE_STEPS, baselineSteps)
      .putInt(KEY_LAST_SENSOR_STEPS, totalSensorSteps)
      .putInt(KEY_TODAY_STEPS, todaySteps)
      .putBoolean(KEY_SENSOR_AVAILABLE, true)
      .putBoolean(KEY_RUNNING, true)
      .apply()
    hasReceivedStepCounterEvent = true
    updateNotification(todaySteps)
  }

  private fun handleStepDetectorEvent() {
    val preferences = getPreferences()
    val todayDateKey = getTodayDateKey()
    val storedDateKey = preferences.getString(KEY_DATE, null)
    val currentSteps = if (storedDateKey == todayDateKey) preferences.getInt(KEY_TODAY_STEPS, 0) else 0
    val todaySteps = currentSteps + 1

    preferences.edit()
      .putString(KEY_DATE, todayDateKey)
      .putInt(KEY_TODAY_STEPS, todaySteps)
      .putBoolean(KEY_SENSOR_AVAILABLE, true)
      .putBoolean(KEY_RUNNING, true)
      .apply()
    updateNotification(todaySteps)
  }

  private fun startAsForeground() {
    createNotificationChannel()
    val notification = buildNotification(readTodaySteps())

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun updateNotification(todaySteps: Int) {
    if (todaySteps == lastNotificationSteps || todaySteps % NOTIFICATION_UPDATE_STEP_INTERVAL != 0) {
      return
    }

    lastNotificationSteps = todaySteps
    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.notify(NOTIFICATION_ID, buildNotification(todaySteps))
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val channel = NotificationChannel(
      NOTIFICATION_CHANNEL_ID,
      "ШагРитм",
      NotificationManager.IMPORTANCE_LOW
    )
    channel.description = "Counts steps while ШагРитм is active"
    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.createNotificationChannel(channel)
  }

  private fun buildNotification(todaySteps: Int): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = android.app.PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
    )

    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle("ШагРитм считает шаги")
        .setContentText("Сегодня: $todaySteps шагов")
        .setOngoing(true)
        .setContentIntent(pendingIntent)
        .build()
    } else {
      Notification.Builder(this)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle("ШагРитм считает шаги")
        .setContentText("Сегодня: $todaySteps шагов")
        .setOngoing(true)
        .setContentIntent(pendingIntent)
        .build()
    }
  }

  private fun readTodaySteps(): Int {
    val preferences = getPreferences()
    val todayDateKey = getTodayDateKey()
    val storedDateKey = preferences.getString(KEY_DATE, null)

    return if (storedDateKey == todayDateKey) preferences.getInt(KEY_TODAY_STEPS, 0) else 0
  }

  private fun storeRunningState(isRunning: Boolean) {
    getPreferences().edit().putBoolean(KEY_RUNNING, isRunning).apply()
  }

  private fun getPreferences() = getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  companion object {
    const val PREFERENCES_NAME = "android_step_counter"
    const val KEY_DATE = "date"
    const val KEY_TODAY_STEPS = "today_steps"
    const val KEY_BASELINE_STEPS = "baseline_steps"
    const val KEY_LAST_SENSOR_STEPS = "last_sensor_steps"
    const val KEY_SENSOR_AVAILABLE = "sensor_available"
    const val KEY_RUNNING = "running"

    private const val NOTIFICATION_ID = 4201
    private const val NOTIFICATION_CHANNEL_ID = "personal_pedometer_steps"
    private const val NOTIFICATION_UPDATE_STEP_INTERVAL = 25

    fun getTodayDateKey(): String {
      return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    }
  }
}
