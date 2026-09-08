package com.personal.pedometer.contracts

data class StepCounterState(
  val dateKey: String?,
  val todaySteps: Int,
  val lastSensorSteps: Int?
)

data class StepCounterUpdateInput(
  val previousState: StepCounterState,
  val eventDateKey: String,
  val totalSensorSteps: Int,
  val canContinueFromPreviousDay: Boolean
)
