import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { foodPhotoJpegQuality, maximumFoodPhotoBytes } from 'src/pedometer/constants';
import type { ThemeColors } from 'src/pedometer/constants';
import { ActionButton, MetricCard } from 'src/pedometer/components';
import { GeminiFoodCalorieBackendError, estimateFoodCaloriesWithGemini } from 'src/pedometer/gemini-food-calorie-estimator';
import { createFoodCameraStyles } from 'src/pedometer/food-camera-styles';
import { formatInteger } from 'src/pedometer/formatting';
import type { AppSettings, FoodCalorieConfidence, FoodCalorieEstimate } from 'src/pedometer/types';

type FoodCameraSlideProps = {
  settings: AppSettings;
  themeColors: ThemeColors;
};

type FoodCameraMessageTone = 'info' | 'success' | 'warning' | 'danger';

type FoodCameraMessage = {
  text: string;
  tone: FoodCameraMessageTone;
};

type FoodPhotoForAnalysis = {
  base64Jpeg: string;
  byteSize: number;
  imageMimeType: string;
  sourceLabel: string;
  uri: string;
};

const supportedFoodPhotoMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const getConfidenceLabel = (confidence: FoodCalorieConfidence): string => {
  switch (confidence) {
    case 'high':
      return 'высокая';
    case 'medium':
      return 'средняя';
    case 'low':
      return 'низкая';
  }
};

const formatMegabytes = (byteSize: number): string => {
  const megabytes = byteSize / 1024 / 1024;
  return Number.isInteger(megabytes) ? `${megabytes} МБ` : `${megabytes.toFixed(1)} МБ`;
};

const calculateBase64ByteSize = (base64Value: string): number => {
  const normalizedBase64Value = base64Value.replace(/\s/g, '');
  const paddingBytes = normalizedBase64Value.endsWith('==') ? 2 : normalizedBase64Value.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalizedBase64Value.length * 3) / 4) - paddingBytes);
};

const getValidatedPhotoByteSize = (base64Jpeg: string, reportedByteSize?: number): number => {
  const encodedByteSize = calculateBase64ByteSize(base64Jpeg);
  const photoByteSize = reportedByteSize ?? encodedByteSize;

  if (photoByteSize > maximumFoodPhotoBytes || encodedByteSize > maximumFoodPhotoBytes) {
    throw new Error(`Выберите фото до ${formatMegabytes(maximumFoodPhotoBytes)}.`);
  }

  return photoByteSize;
};

const getPickedImageMimeType = (pickedAsset: ImagePickerAsset): string => {
  const imageMimeType = pickedAsset.mimeType?.trim().toLocaleLowerCase('en-US') ?? 'image/jpeg';

  if (!supportedFoodPhotoMimeTypes.has(imageMimeType)) {
    throw new Error('Выберите фото в формате JPG, PNG или WEBP.');
  }

  return imageMimeType;
};

const getPickedFoodPhoto = (pickedAsset: ImagePickerAsset, sourceLabel: string): FoodPhotoForAnalysis => {
  if (pickedAsset.type && pickedAsset.type !== 'image') {
    throw new Error('Выберите изображение еды, не видео.');
  }

  if (!pickedAsset.base64) {
    throw new Error('Выбранное фото не содержит JPEG-данных для анализа.');
  }

  return {
    base64Jpeg: pickedAsset.base64,
    byteSize: getValidatedPhotoByteSize(pickedAsset.base64, pickedAsset.fileSize),
    imageMimeType: getPickedImageMimeType(pickedAsset),
    sourceLabel,
    uri: pickedAsset.uri,
  };
};

export const FoodCameraSlide = ({ settings, themeColors }: FoodCameraSlideProps) => {
  const [isEstimating, setIsEstimating] = useState(false);
  const [selectedPhotoPreviewUri, setSelectedPhotoPreviewUri] = useState<string | null>(null);
  const [calorieEstimate, setCalorieEstimate] = useState<FoodCalorieEstimate | null>(null);
  const [cameraMessage, setCameraMessage] = useState<FoodCameraMessage | null>(null);
  const styles = useMemo(() => createFoodCameraStyles(themeColors), [themeColors]);
  const foodPhotoLimitLabel = formatMegabytes(maximumFoodPhotoBytes);

  const analyzeFoodPhoto = useCallback(async (foodPhoto: FoodPhotoForAnalysis): Promise<void> => {
    setIsEstimating(true);
    setCalorieEstimate(null);
    setSelectedPhotoPreviewUri(foodPhoto.uri);

    try {
      setCameraMessage({ text: `Отправляю фото в Gemini AI: ${formatMegabytes(foodPhoto.byteSize)}.`, tone: 'info' });
      let nextCalorieEstimate: FoodCalorieEstimate;

      try {
        nextCalorieEstimate = await estimateFoodCaloriesWithGemini({
          base64Image: foodPhoto.base64Jpeg,
          imageMimeType: foodPhoto.imageMimeType,
          sourceLabel: foodPhoto.sourceLabel,
        });
      } catch (geminiError) {
        if (geminiError instanceof GeminiFoodCalorieBackendError && geminiError.isConfigurationError) {
          setCameraMessage(null);
          return;
        }

        throw geminiError;
      }

      setCalorieEstimate({
        ...nextCalorieEstimate,
        description: nextCalorieEstimate.description,
        servingNotes: nextCalorieEstimate.servingNotes,
      });
      setCameraMessage({ text: 'Gemini AI распознал фото и рассчитал калории.', tone: 'success' });
    } catch (error) {
      setCameraMessage({
        text: error instanceof Error ? error.message : 'Не удалось автоматически оценить калории по фото.',
        tone: 'danger',
      });
    } finally {
      setIsEstimating(false);
    }
  }, []);

  const uploadFoodPhoto = useCallback(async (): Promise<void> => {
    try {
      const imagePickerResult = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: false,
        base64: true,
        mediaTypes: ['images'],
        quality: foodPhotoJpegQuality,
        selectionLimit: 1,
      });

      if (imagePickerResult.canceled) {
        setSelectedPhotoPreviewUri(null);
        setCalorieEstimate(null);
        setCameraMessage({ text: 'Выбор фото отменен.', tone: 'info' });
        return;
      }

      const pickedAsset = imagePickerResult.assets[0];

      if (!pickedAsset) {
        throw new Error('Фото не выбрано.');
      }

      await analyzeFoodPhoto(getPickedFoodPhoto(pickedAsset, 'загруженное фото'));
    } catch (error) {
      setCameraMessage({
        text: error instanceof Error ? error.message : 'Не удалось загрузить фото еды.',
        tone: 'danger',
      });
    }
  }, [analyzeFoodPhoto]);

  const takeFoodPhoto = useCallback(async (): Promise<void> => {
    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();

      if (!cameraPermission.granted) {
        setCameraMessage({ text: 'Разрешите доступ к камере, чтобы сфотографировать еду.', tone: 'warning' });
        return;
      }

      const imagePickerResult = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        base64: true,
        mediaTypes: ['images'],
        quality: foodPhotoJpegQuality,
      });

      if (imagePickerResult.canceled) {
        setSelectedPhotoPreviewUri(null);
        setCalorieEstimate(null);
        setCameraMessage({ text: 'Съемка фото отменена.', tone: 'info' });
        return;
      }

      const pickedAsset = imagePickerResult.assets[0];

      if (!pickedAsset) {
        throw new Error('Фото не получено.');
      }

      await analyzeFoodPhoto(getPickedFoodPhoto(pickedAsset, 'снимок с камеры'));
    } catch (error) {
      setCameraMessage({
        text: error instanceof Error ? error.message : 'Не удалось сфотографировать еду.',
        tone: 'danger',
      });
    }
  }, [analyzeFoodPhoto]);

  const cameraMessageStyle = useMemo(() => {
    if (!cameraMessage) {
      return null;
    }

    switch (cameraMessage.tone) {
      case 'success':
        return styles.successMessage;
      case 'warning':
        return styles.warningMessage;
      case 'danger':
        return styles.dangerMessage;
      case 'info':
        return styles.infoMessage;
    }
  }, [cameraMessage, styles]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Калории по фото</Text>
        <Text style={styles.sectionSubtitle}>Загрузите фото до {foodPhotoLimitLabel}, чтобы получить примерную оценку порции.</Text>
      </View>

      <View style={styles.sourcePanel}>
        <Ionicons name="image" size={36} color={themeColors.primary} />
        <View style={styles.sourceCopy}>
          <Text style={styles.sourceTitle}>Фото еды</Text>
          <Text style={styles.sourceText}>Сфотографируйте еду или выберите одно изображение до {foodPhotoLimitLabel}.</Text>
        </View>
      </View>

      {cameraMessage ? (
        <View style={[styles.messagePanel, cameraMessageStyle]}>
          <Ionicons
            name={cameraMessage.tone === 'danger' || cameraMessage.tone === 'warning' ? 'alert-circle' : 'checkmark-circle'}
            color={cameraMessage.tone === 'danger' ? themeColors.danger : cameraMessage.tone === 'warning' ? themeColors.warning : themeColors.primary}
            size={20}
          />
          <Text style={styles.messageText}>{cameraMessage.text}</Text>
        </View>
      ) : null}

      <View style={styles.actionStack}>
        <ActionButton
          disabled={isEstimating}
          icon="camera"
          label={isEstimating ? 'Считаю...' : 'Сфотографировать'}
          onPress={takeFoodPhoto}
          themeColors={themeColors}
        />
        <ActionButton
          disabled={isEstimating}
          icon="cloud-upload"
          label="Загрузить фото"
          onPress={uploadFoodPhoto}
          themeColors={themeColors}
          tone="neutral"
        />
      </View>

      {calorieEstimate ? (
        <View style={styles.resultPanel}>
          <View style={styles.resultHeader}>
            <View style={styles.resultIcon}>
              <Ionicons name="flame" size={22} color={themeColors.surface} />
            </View>
            <View style={styles.resultCopy}>
              <Text style={styles.resultLabel}>Оценка порции</Text>
              <Text style={styles.resultCalories} numberOfLines={1} adjustsFontSizeToFit>
                {formatInteger(calorieEstimate.calories, settings)} ккал
              </Text>
            </View>
          </View>
          <Text style={styles.resultDescription}>{calorieEstimate.description}</Text>
          <View style={styles.estimateMeta}>
            <MetricCard
              icon="analytics"
              label="Уверенность"
              value={getConfidenceLabel(calorieEstimate.confidence)}
              themeColors={themeColors}
              tone="blue"
            />
            <MetricCard
              icon="restaurant"
              label="Позиций"
              value={formatInteger(calorieEstimate.items.length, settings)}
              themeColors={themeColors}
              tone="warm"
            />
          </View>
          {calorieEstimate.items.length > 0 ? (
            <View style={styles.itemsList}>
              {calorieEstimate.items.map((estimateItem) => (
                <View key={`${estimateItem.name}-${estimateItem.calories}`} style={styles.itemRow}>
                  <Text style={styles.itemName}>{estimateItem.name}</Text>
                  <Text style={styles.itemCalories}>{formatInteger(estimateItem.calories, settings)} ккал</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={styles.servingNotes}>{calorieEstimate.servingNotes}</Text>
        </View>
      ) : null}

      {selectedPhotoPreviewUri ? <Image source={{ uri: selectedPhotoPreviewUri }} style={styles.photoPreview} /> : null}
    </View>
  );
};
