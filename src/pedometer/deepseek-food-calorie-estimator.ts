import { maximumReasonableFoodCalories } from 'src/pedometer/constants';
import type { FoodCalorieConfidence, FoodCalorieEstimate, FoodCalorieEstimateItem } from 'src/pedometer/types';

declare const process: {
  env?: {
    EXPO_PUBLIC_FOOD_CALORIE_BACKEND_URL?: string;
  };
};

type DeepSeekFoodCalorieEstimationInput = {
  query: string;
  recognitionModelLabel: string;
  recognitionProbability: number;
  recognizedLabel: string;
  servingGrams: number;
};

const defaultFoodCalorieBackendUrl = 'http://localhost:18000/food-calorie-estimate';

const getFoodCalorieBackendUrl = (): string => {
  const configuredUrl = process.env?.EXPO_PUBLIC_FOOD_CALORIE_BACKEND_URL?.trim();
  return configuredUrl && configuredUrl.length > 0 ? configuredUrl : defaultFoodCalorieBackendUrl;
};

const createBackendUnavailableMessage = (backendUrl: string): string => {
  return `Backend DeepSeek не отвечает по адресу ${backendUrl}. Запустите backend командой npm run backend:deepseek и проверьте DEEPSEEK_API_KEY.`;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseCalories = (rawValue: unknown, fieldName: string): number => {
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    throw new Error(`${fieldName}: backend вернул нечисловое значение.`);
  }

  if (rawValue < 0 || rawValue > maximumReasonableFoodCalories) {
    throw new Error(`${fieldName}: backend вернул значение вне допустимого диапазона.`);
  }

  return Math.round(rawValue);
};

const parseConfidence = (rawValue: unknown): FoodCalorieConfidence => {
  if (rawValue === 'low' || rawValue === 'medium' || rawValue === 'high') {
    return rawValue;
  }

  throw new Error('Backend вернул неизвестную уверенность оценки.');
};

const parseNonEmptyString = (rawValue: unknown, fieldName: string): string => {
  if (typeof rawValue !== 'string') {
    throw new Error(`${fieldName}: backend вернул не текст.`);
  }

  const trimmedValue = rawValue.trim();

  if (trimmedValue.length === 0) {
    throw new Error(`${fieldName}: backend вернул пустой текст.`);
  }

  return trimmedValue;
};

const parseEstimateItems = (rawItems: unknown): FoodCalorieEstimateItem[] => {
  if (!Array.isArray(rawItems)) {
    throw new Error('Backend вернул список продуктов в неизвестном формате.');
  }

  const estimateItems: FoodCalorieEstimateItem[] = [];

  for (const rawItem of rawItems) {
    if (!isObjectRecord(rawItem)) {
      throw new Error('Backend вернул продукт в неизвестном формате.');
    }

    estimateItems.push({
      name: parseNonEmptyString(rawItem.name, 'Продукт'),
      calories: parseCalories(rawItem.calories, 'Калории продукта'),
    });
  }

  return estimateItems;
};

const parseFoodCalorieEstimate = (rawValue: unknown): FoodCalorieEstimate => {
  if (!isObjectRecord(rawValue)) {
    throw new Error('Backend вернул оценку калорий в неизвестном формате.');
  }

  return {
    calories: parseCalories(rawValue.calories, 'Калории'),
    confidence: parseConfidence(rawValue.confidence),
    description: parseNonEmptyString(rawValue.description, 'Описание'),
    items: parseEstimateItems(rawValue.items),
    servingNotes: parseNonEmptyString(rawValue.servingNotes, 'Примечание'),
  };
};

const extractBackendErrorMessage = (responseBody: unknown): string | null => {
  if (!isObjectRecord(responseBody)) {
    return null;
  }

  if (typeof responseBody.message === 'string') {
    return responseBody.message;
  }

  const errorRecord = isObjectRecord(responseBody.error) ? responseBody.error : null;
  return typeof errorRecord?.message === 'string' ? errorRecord.message : null;
};

export const estimateFoodCaloriesWithDeepSeek = async (
  input: DeepSeekFoodCalorieEstimationInput,
): Promise<FoodCalorieEstimate> => {
  const backendUrl = getFoodCalorieBackendUrl();
  let response: Response;

  try {
    response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error(createBackendUnavailableMessage(backendUrl));
  }

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch {
    throw new Error('Backend вернул нечитабельный ответ.');
  }

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(responseBody) ?? `Backend не принял запрос: HTTP ${response.status}.`);
  }

  return parseFoodCalorieEstimate(responseBody);
};
