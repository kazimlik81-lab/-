package com.personal.pedometer

import com.personal.pedometer.contracts.StepCounterState
import com.personal.pedometer.contracts.StepCounterUpdateInput

private const val TODAY = "2026-09-04"
private const val YESTERDAY = "2026-09-03"

private fun update(
  previousState: StepCounterState,
  totalSensorSteps: Int,
  eventDateKey: String = TODAY,
  canContinueFromPreviousDay: Boolean = true
): StepCounterState = calculateStepCounterState(
  StepCounterUpdateInput(previousState, eventDateKey, totalSensorSteps, canContinueFromPreviousDay)
)

private fun expectState(name: String, actual: StepCounterState, expected: StepCounterState) {
  check(actual == expected) { "$name: expected $expected, received $actual" }
  println("PASS $name")
}

fun main() {
  val morningState = StepCounterState(TODAY, 3000, 8000)
  val resetState = update(morningState, 1000)
  expectState("same-day reset keeps morning steps", resetState, StepCounterState(TODAY, 3000, 1000))
  expectState("walking after reset adds only new steps", update(resetState, 1012), StepCounterState(TODAY, 3012, 1012))
  expectState("reopening with the same sensor reading is idempotent", update(resetState, 1000), resetState)
  expectState("ordinary counter increase survives recreation", update(morningState, 9200), StepCounterState(TODAY, 4200, 9200))
  expectState("original negative-baseline regression", update(StepCounterState(TODAY, 500, 1000), 1), StepCounterState(TODAY, 500, 1))

  val initialState = update(StepCounterState(null, 0, null), 25000)
  expectState("first activation excludes earlier sensor lifetime", initialState, StepCounterState(TODAY, 0, 25000))
  expectState("first activation starts counting new steps", update(initialState, 25007), StepCounterState(TODAY, 7, 25007))
  expectState("saved steps survive missing sensor reference", update(StepCounterState(TODAY, 3000, null), 100), StepCounterState(TODAY, 3000, 100))
  expectState("midnight starts a new daily total", update(StepCounterState(YESTERDAY, 8650, 25000), 25008), StepCounterState(TODAY, 8, 25008))
  expectState("midnight reset does not carry yesterday forward", update(StepCounterState(YESTERDAY, 8650, 25000), 10), StepCounterState(TODAY, 0, 10))
  expectState(
    "starting on another day without continuity establishes a reference",
    update(StepCounterState(YESTERDAY, 8650, 25000), 27000, canContinueFromPreviousDay = false),
    StepCounterState(TODAY, 0, 27000)
  )

  val delayedPreviousDayState = update(StepCounterState(YESTERDAY, 8650, 25000), 25005, eventDateKey = YESTERDAY)
  expectState("delayed previous-day event retains its supplied date", delayedPreviousDayState, StepCounterState(YESTERDAY, 8655, 25005))
  expectState("new day follows delayed batch without carrying old steps", update(delayedPreviousDayState, 25009), StepCounterState(TODAY, 4, 25009))

  var sequenceState = morningState
  val sensorSequence = listOf(8000, 8100, 8100, 0, 0, 1, 49, 50, 12, 12, 40, 800, 3, 4)
  for (sensorSteps in sensorSequence) {
    val previousDailySteps = sequenceState.todaySteps
    sequenceState = update(sequenceState, sensorSteps)
    check(sequenceState.todaySteps >= previousDailySteps) {
      "Same-day accumulated steps decreased after sensor event $sensorSteps."
    }
  }
  expectState("repeated resets and duplicate events preserve accumulated steps", sequenceState, StepCounterState(TODAY, 3939, 4))
  println("All 14 native step-counter regression checks passed.")
}
