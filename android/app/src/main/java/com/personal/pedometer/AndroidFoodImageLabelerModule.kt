package com.personal.pedometer

import android.graphics.BitmapFactory
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions

class AndroidFoodImageLabelerModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private val imageLabeler by lazy {
    val options = ImageLabelerOptions.Builder()
      .setConfidenceThreshold(0.2f)
      .build()

    ImageLabeling.getClient(options)
  }

  override fun getName(): String = "AndroidFoodImageLabeler"

  @ReactMethod
  fun recognize(base64Jpeg: String, promise: Promise) {
    try {
      val imageBytes = Base64.decode(base64Jpeg, Base64.DEFAULT)
      val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)

      if (bitmap == null) {
        promise.reject("ANDROID_FOOD_IMAGE_LABELER_INVALID_IMAGE", "Не удалось прочитать фото для локального анализа.")
        return
      }

      val image = InputImage.fromBitmap(bitmap, 0)

      imageLabeler.process(image)
        .addOnSuccessListener { labels ->
          val result = Arguments.createArray()

          labels
            .sortedByDescending { label -> label.confidence }
            .take(12)
            .forEach { label ->
              val labelMap = Arguments.createMap()
              labelMap.putString("text", label.text)
              labelMap.putDouble("confidence", label.confidence.toDouble())
              labelMap.putInt("index", label.index)
              result.pushMap(labelMap)
            }

          promise.resolve(result)
        }
        .addOnFailureListener { error ->
          promise.reject("ANDROID_FOOD_IMAGE_LABELER_FAILED", error)
        }
        .addOnCompleteListener {
          bitmap.recycle()
        }
    } catch (error: Exception) {
      promise.reject("ANDROID_FOOD_IMAGE_LABELER_FAILED", error)
    }
  }
}
