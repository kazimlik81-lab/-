import {
  defaultFoodCalorieVisionModel,
  maximumReasonableFoodCalories,
  missingOpenAiApiKeyMessage,
  openAiResponsesApiUrl,
} from 'src/pedometer/constants';
import type { FoodCalorieConfidence, FoodCalorieEstimate, FoodCalorieEstimateItem } from 'src/pedometer/types';

declare const process: {
  env?: {
    EXPO_PUBLIC_OPENAI_API_KEY?: string;
    EXPO_PUBLIC_OPENAI_FOOD_MODEL?: string;
  };
};

type FoodCalorieEstimationInput = {
  base64Jpeg: string;
  openAiApiKey?: string | null;
};

type OpenAiRequestContent = {
  type: 'input_text' | 'input_image';
  text?: string;
  image_url?: string;
  detail?: 'low' | 'high' | 'auto';
};

const foodCalorieEstimateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['calories', 'confidence', 'description', 'items', 'servingNotes'],
  properties: {
    calories: {
      type: 'number',
      description: 'Estimated total kilocalories for all visible edible food in the image.',
    },
    confidence: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    description: {
      type: 'string',
      description: 'Short Russian description of the visible food.',
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'calories'],
        properties: {
          name: {
            type: 'string',
          },
          calories: {
            type: 'number',
          },
        },
      },
    },
    servingNotes: {
      type: 'string',
      description: 'Short Russian note about portion uncertainty or why the estimate may be approximate.',
    },
  },
};

const foodCaloriePrompt = [
  'Оцени калорийность всей видимой съедобной еды на фото.',
  'Верни только структуру по схеме.',
  'Калории указывай в килокалориях.',
  'Если еды не видно, верни 0 калорий, confidence low, пустой список items и короткое объяснение.',
  'Не считай посуду, упаковку, напитки без калорий и фон.',
  'Пиши description, item names и servingNotes по-русски.',
].join(' ');

const normalizeOpenAiApiKey = (rawApiKey: string | null | undefined): string | null => {
  const normalizedApiKey = rawApiKey?.trim();
  return normalizedApiKey && normalizedApiKey.length > 0 ? normalizedApiKey : null;
};

const getOpenAiApiKey = (providedApiKey?: string | null): string | null => {
  const normalizedProvidedApiKey = normalizeOpenAiApiKey(providedApiKey);

  if (normalizedProvidedApiKey) {
    return normalizedProvidedApiKey;
  }

  const rawApiKey = process.env?.EXPO_PUBLIC_OPENAI_API_KEY?.trim();
  return rawApiKey && rawApiKey.length > 0 ? rawApiKey : null;
};

const getFoodCalorieVisionModel = (): string => {
  const configuredModel = process.env?.EXPO_PUBLIC_OPENAI_FOOD_MODEL?.trim();
  return configuredModel && configuredModel.length > 0 ? configuredModel : defaultFoodCalorieVisionModel;
};

export const isFoodCalorieEstimatorConfigured = (): boolean => {
  return getOpenAiApiKey() !== null;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const extractOpenAiErrorMessage = (responseBody: unknown): string | null => {
  if (!isObjectRecord(responseBody) || !isObjectRecord(responseBody.error)) {
    return null;
  }

  return typeof responseBody.error.message === 'string' ? responseBody.error.message : null;
};

const extractOpenAiOutputText = (responseBody: unknown): string => {
  if (!isObjectRecord(responseBody)) {
    throw new Error('OpenAI вернул ответ в неизвестном формате.');
  }

  if (typeof responseBody.output_text === 'string' && responseBody.output_text.trim().length > 0) {
    return responseBody.output_text;
  }

  if (!Array.isArray(responseBody.output)) {
    throw new Error('OpenAI не вернул текст оценки калорий.');
  }

  for (const outputItem of responseBody.output) {
    if (!isObjectRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (!isObjectRecord(contentItem)) {
        continue;
      }

      if (typeof contentItem.text === 'string' && contentItem.text.trim().length > 0) {
        return contentItem.text;
      }
    }
  }

  throw new Error('OpenAI не вернул текст оценки калорий.');
};

const parseCalories = (rawValue: unknown, fieldName: string): number => {
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    throw new Error(`${fieldName}: OpenAI вернул нечисловое значение.`);
  }

  if (rawValue < 0 || rawValue > maximumReasonableFoodCalories) {
    throw new Error(`${fieldName}: OpenAI вернул значение вне допустимого диапазона.`);
  }

  return Math.round(rawValue);
};

const parseConfidence = (rawValue: unknown): FoodCalorieConfidence => {
  if (rawValue === 'low' || rawValue === 'medium' || rawValue === 'high') {
    return rawValue;
  }

  throw new Error('OpenAI вернул неизвестную уверенность оценки.');
};

const parseNonEmptyString = (rawValue: unknown, fieldName: string): string => {
  if (typeof rawValue !== 'string') {
    throw new Error(`${fieldName}: OpenAI вернул не текст.`);
  }

  const trimmedValue = rawValue.trim();

  if (trimmedValue.length === 0) {
    throw new Error(`${fieldName}: OpenAI вернул пустой текст.`);
  }

  return trimmedValue;
};

const parseEstimateItems = (rawItems: unknown): FoodCalorieEstimateItem[] => {
  if (!Array.isArray(rawItems)) {
    throw new Error('OpenAI вернул список продуктов в неизвестном формате.');
  }

  const estimateItems: FoodCalorieEstimateItem[] = [];

  for (const rawItem of rawItems) {
    if (!isObjectRecord(rawItem)) {
      throw new Error('OpenAI вернул продукт в неизвестном формате.');
    }

    estimateItems.push({
      name: parseNonEmptyString(rawItem.name, 'Продукт'),
      calories: parseCalories(rawItem.calories, 'Калории продукта'),
    });
  }

  return estimateItems;
};

const parseFoodCalorieEstimate = (rawText: string): FoodCalorieEstimate => {
  const parsedValue: unknown = JSON.parse(rawText);

  if (!isObjectRecord(parsedValue)) {
    throw new Error('OpenAI вернул оценку калорий в неизвестном формате.');
  }

  return {
    calories: parseCalories(parsedValue.calories, 'Калории'),
    confidence: parseConfidence(parsedValue.confidence),
    description: parseNonEmptyString(parsedValue.description, 'Описание'),
    items: parseEstimateItems(parsedValue.items),
    servingNotes: parseNonEmptyString(parsedValue.servingNotes, 'Примечание'),
  };
};

export const estimateFoodCalories = async (input_data: FoodCalorieEstimationInput): Promise<FoodCalorieEstimate> => {
  const openAiApiKey = getOpenAiApiKey(input_data.openAiApiKey);

  if (!openAiApiKey) {
    throw new Error(missingOpenAiApiKeyMessage);
  }

  if (input_data.base64Jpeg.trim().length === 0) {
    throw new Error('Фото еды не содержит JPEG-данных для анализа.');
  }

  const requestContent: OpenAiRequestContent[] = [
    {
      type: 'input_text',
      text: foodCaloriePrompt,
    },
    {
      type: 'input_image',
      image_url: `data:image/jpeg;base64,${input_data.base64Jpeg}`,
      detail: 'high',
    },
  ];

  const response = await fetch(openAiResponsesApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getFoodCalorieVisionModel(),
      store: false,
      max_output_tokens: 600,
      input: [
        {
          role: 'user',
          content: requestContent,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'food_calorie_estimate',
          strict: true,
          schema: foodCalorieEstimateSchema,
        },
      },
    }),
  });

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch {
    throw new Error('OpenAI вернул нечитабельный ответ.');
  }

  if (!response.ok) {
    throw new Error(extractOpenAiErrorMessage(responseBody) ?? `OpenAI не принял фото: HTTP ${response.status}.`);
  }

  return parseFoodCalorieEstimate(extractOpenAiOutputText(responseBody));
};
