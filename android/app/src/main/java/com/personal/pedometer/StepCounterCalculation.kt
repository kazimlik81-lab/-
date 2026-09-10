package com.personal.pedometer

import com.personal.pedometer.contracts.StepCounterState
import com.personal.pedometer.contracts.StepCounterUpdateInput

fun calculateStepCounterState(input: StepCounterUpdateInput): StepCounterState {
  val previousState = input.previousState
  val isSameDay = previousState.dateKey == input.eventDateKey
  val previousSensorSteps = previousState.lastSensorSteps
  val canCalculateDelta = previousSensorSteps != null &&
    input.totalSensorSteps >= previousSensorSteps &&
    (isSameDay || (previousState.dateKey != null && input.canContinueFromPreviousDay))
  val countedSteps = if (isSameDay) previousState.todaySteps else 0
  val additionalSteps = if (canCalculateDelta) {
    input.totalSensorSteps - previousSensorSteps
  } else {
    // A reset or first reading establishes a new reference without erasing saved steps.
    0
  }

  return StepCounterState(
    dateKey = input.eventDateKey,
    todaySteps = countedSteps + additionalSteps,
    lastSensorSteps = input.totalSensorSteps
  )
}
