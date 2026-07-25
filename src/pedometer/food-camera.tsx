import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { maximumFoodPhotoBytes } from 'src/pedometer/constants';
import type { ThemeColors } from 'src/pedometer/constants';
import { ActionButton, MetricCard } from 'src/pedometer/components';
import { estimateFoodCaloriesWithDeepSeek } from 'src/pedometer/deepseek-food-calorie-estimator';
import { recognizeFoodPhotoAutomatically } from 'src/pedometer/food-photo-auto-recognizer';
import { formatInteger } from 'src/pedometer/formatting';
import type { AppSettings, FoodCalorieConfidence, FoodCalorieEstimate } from 'src/pedometer/types';
import { estimateFoodCaloriesLocally } from 'src/pedometer/usda-food-calorie-estimator';

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
  fileName?: string | null;
  sourceLabel: string;
  uri: string;
};

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

const getPickedFoodPhoto = (pickedAsset: ImagePickerAsset): FoodPhotoForAnalysis => {
  if (pickedAsset.type && pickedAsset.type !== 'image') {
    throw new Error('Выберите изображение еды, не видео.');
  }

  if (!pickedAsset.base64) {
    throw new Error('Выбранное фото не содержит JPEG-данных для анализа.');
  }

  return {
    base64Jpeg: pickedAsset.base64,
    byteSize: getValidatedPhotoByteSize(pickedAsset.base64, pickedAsset.fileSize),
    fileName: pickedAsset.fileName,
    sourceLabel: 'загруженное фото',
    uri: pickedAsset.uri,
  };
};

const formatProbabilityPercent = (probability: number): string => {
  return `${Math.round(probability * 100)}%`;
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
      setCameraMessage({ text: `Распознаю еду по фото: ${formatMegabytes(foodPhoto.byteSize)}.`, tone: 'info' });
      const foodRecognition = await recognizeFoodPhotoAutomatically(foodPhoto);
      setCameraMessage({ text: `Похоже на ${foodRecognition.label}. Отправляю запрос в backend DeepSeek.`, tone: 'info' });
      let nextCalorieEstimate: FoodCalorieEstimate;
      let resultMessage: FoodCameraMessage | null = { text: 'Фото распознано, калории рассчитаны через DeepSeek.', tone: 'success' };
      let servingNotesPrefix = `Автораспознавание: ${foodRecognition.modelLabel}, вероятность ${formatProbabilityPercent(foodRecognition.probability)}. `;

      try {
        nextCalorieEstimate = await estimateFoodCaloriesWithDeepSeek({
          query: foodRecognition.query,
          recognitionModelLabel: foodRecognition.modelLabel,
          recognitionProbability: foodRecognition.probability,
          recognizedLabel: foodRecognition.label,
          servingGrams: foodRecognition.servingGrams,
        });
      } catch {
        nextCalorieEstimate = estimateFoodCaloriesLocally({
          query: foodRecognition.query,
          servingGrams: foodRecognition.servingGrams,
        });
        resultMessage = null;
      }

      setCalorieEstimate({
        ...nextCalorieEstimate,
        description: `Похоже на: ${foodRecognition.label}. ${nextCalorieEstimate.description}`,
        servingNotes: `${servingNotesPrefix}${nextCalorieEstimate.servingNotes}`,
      });
      setCameraMessage(resultMessage);
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
        quality: 1,
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

      await analyzeFoodPhoto(getPickedFoodPhoto(pickedAsset));
    } catch (error) {
      setCameraMessage({
        text: error instanceof Error ? error.message : 'Не удалось загрузить фото еды.',
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
          <Text style={styles.sourceTitle}>Загрузить фото</Text>
          <Text style={styles.sourceText}>Выберите одно изображение еды до {foodPhotoLimitLabel}.</Text>
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

      <ActionButton
        disabled={isEstimating}
        icon="cloud-upload"
        label={isEstimating ? 'Считаю...' : 'Загрузить фото'}
        onPress={uploadFoodPhoto}
        themeColors={themeColors}
      />

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

const createFoodCameraStyles = (themeColors: ThemeColors) => StyleSheet.create({
  section: {
    gap: 16,
  },
  sectionHeading: {
    gap: 6,
  },
  sectionTitle: {
    color: themeColors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: themeColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  sourcePanel: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderColor: themeColors.highlight,
    borderLeftWidth: 1,
    borderRadius: 18,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 124,
    padding: 16,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 9, height: 9 },
    shadowOpacity: 0.36,
    shadowRadius: 20,
    elevation: 7,
  },
  sourceCopy: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  sourceTitle: {
    color: themeColors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  sourceText: {
    color: themeColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  messagePanel: {
    alignItems: 'flex-start',
    borderColor: themeColors.highlight,
    borderLeftWidth: 1,
    borderRadius: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  infoMessage: {
    backgroundColor: themeColors.surface,
  },
  successMessage: {
    backgroundColor: themeColors.primaryMuted,
  },
  warningMessage: {
    backgroundColor: themeColors.warningMuted,
  },
  dangerMessage: {
    backgroundColor: themeColors.dangerMuted,
  },
  messageText: {
    color: themeColors.textPrimary,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  resultPanel: {
    backgroundColor: themeColors.surface,
    borderColor: themeColors.highlight,
    borderLeftWidth: 1,
    borderRadius: 18,
    borderTopWidth: 1,
    gap: 14,
    padding: 16,
    shadowColor: themeColors.shadow,
    shadowOffset: { width: 9, height: 9 },
    shadowOpacity: 0.36,
    shadowRadius: 20,
    elevation: 7,
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  resultIcon: {
    alignItems: 'center',
    backgroundColor: themeColors.warning,
    borderRadius: 14,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  resultCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  resultLabel: {
    color: themeColors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  resultCalories: {
    color: themeColors.textPrimary,
    fontSize: 30,
    fontWeight: '900',
  },
  resultDescription: {
    color: themeColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  estimateMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  itemsList: {
    borderColor: themeColors.borderSubtle,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemRow: {
    alignItems: 'center',
    borderBottomColor: themeColors.borderSubtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  itemName: {
    color: themeColors.textPrimary,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 0,
  },
  itemCalories: {
    color: themeColors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  servingNotes: {
    color: themeColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  photoPreview: {
    alignSelf: 'center',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    height: 140,
  },
});
