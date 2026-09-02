type IncomingMessage = import('node:http').IncomingMessage;
type ServerResponse = import('node:http').ServerResponse;

const { existsSync, readFileSync } = require('node:fs') as typeof import('node:fs');
const { createServer } = require('node:http') as typeof import('node:http');
const { join } = require('node:path') as typeof import('node:path');

type FoodCalorieConfidence = 'low' | 'medium' | 'high';

type GeminiBackendEstimateRequest = {
  base64Image: string;
  imageMimeType: string;
  sourceLabel: string;
};

type FoodCalorieEstimateItem = {
  calories: number;
  name: string;
};

type FoodCalorieEstimate = {
  calories: number;
  confidence: FoodCalorieConfidence;
  description: string;
  items: FoodCalorieEstimateItem[];
  servingNotes: string;
};

type GeminiGenerateContentPart = {
  text?: unknown;
};

type GeminiGenerateContentCandidate = {
  content?: {
    parts?: GeminiGenerateContentPart[];
  };
};

const defaultGeminiApiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';
const defaultGeminiFoodCalorieModel = 'gemini-2.0-flash';
const defaultBackendPort = 18000;
const maximumFoodPhotoBytes = 16 * 1024 * 1024;
const maximumReasonableFoodCalories = 25000;
const maximumRequestBodyBytes = Math.ceil((maximumFoodPhotoBytes * 4) / 3) + 512 * 1024;
const localGeminiEnvironmentFileName = 'gemini.env';
const supportedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const foodCalorieEstimateSchema = {
  type: 'object',
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

const parseEnvironmentValue = (rawValue: string): string => {
  const trimmedValue = rawValue.trim();

  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"'))
    || (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
};

const loadLocalGeminiEnvironmentFile = (): void => {
  const environmentFilePath = join(process.cwd(), localGeminiEnvironmentFileName);

  if (!existsSync(environmentFilePath)) {
    return;
  }

  const environmentFileText = readFileSync(environmentFilePath, 'utf8');
  const environmentLines = environmentFileText.split(/\r?\n/);

  for (const environmentLine of environmentLines) {
    const trimmedLine = environmentLine.trim();

    if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex <= 0) {
      continue;
    }

    const environmentKey = trimmedLine.slice(0, separatorIndex).trim();
    const environmentValue = parseEnvironmentValue(trimmedLine.slice(separatorIndex + 1));

    if (!process.env[environmentKey]) {
      process.env[environmentKey] = environmentValue;
    }
  }
};

loadLocalGeminiEnvironmentFile();

const getGeminiApiKey = (): string => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY не задан на backend.');
  }

  return apiKey;
};

const getGeminiApiBaseUrl = (): string => {
  const configuredApiBaseUrl = process.env.GEMINI_API_BASE_URL?.trim();
  return configuredApiBaseUrl && configuredApiBaseUrl.length > 0 ? configuredApiBaseUrl : defaultGeminiApiBaseUrl;
};

const getGeminiFoodCalorieModel = (): string => {
  const configuredModel = process.env.GEMINI_FOOD_MODEL?.trim();
  return configuredModel && configuredModel.length > 0 ? configuredModel : defaultGeminiFoodCalorieModel;
};

const getGeminiGenerateContentUrl = (): string => {
  const rawModel = getGeminiFoodCalorieModel();
  const modelPath = rawModel.startsWith('models/') || rawModel.startsWith('tunedModels/') ? rawModel : `models/${rawModel}`;
  const encodedModelPath = modelPath.split('/').map((pathPart) => encodeURIComponent(pathPart)).join('/');
  return `${getGeminiApiBaseUrl()}/${encodedModelPath}:generateContent?key=${encodeURIComponent(getGeminiApiKey())}`;
};

const getBackendPort = (): number => {
  const configuredPort = Number(process.env.GEMINI_BACKEND_PORT);
  return Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : defaultBackendPort;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseNonEmptyString = (rawValue: unknown, fieldName: string): string => {
  if (typeof rawValue !== 'string') {
    throw new Error(`${fieldName}: ожидался текст.`);
  }

  const trimmedValue = rawValue.trim();

  if (trimmedValue.length === 0) {
    throw new Error(`${fieldName}: значение пустое.`);
  }

  return trimmedValue;
};

const parseNumber = (rawValue: unknown, fieldName: string): number => {
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    throw new Error(`${fieldName}: ожидалось число.`);
  }

  return rawValue;
};

const calculateBase64ByteSize = (base64Value: string): number => {
  const paddingBytes = base64Value.endsWith('==') ? 2 : base64Value.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64Value.length * 3) / 4) - paddingBytes);
};

const parseBase64Image = (rawValue: unknown): string => {
  const base64Image = parseNonEmptyString(rawValue, 'base64Image').replace(/\s/g, '');

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Image)) {
    throw new Error('base64Image: ожидались base64-данные изображения.');
  }

  const imageByteSize = calculateBase64ByteSize(base64Image);

  if (imageByteSize <= 0 || imageByteSize > maximumFoodPhotoBytes) {
    throw new Error(`base64Image должен быть от 1 до ${maximumFoodPhotoBytes} байт после декодирования.`);
  }

  return base64Image;
};

const parseImageMimeType = (rawValue: unknown): string => {
  const imageMimeType = parseNonEmptyString(rawValue, 'imageMimeType').toLocaleLowerCase('en-US');

  if (!supportedImageMimeTypes.has(imageMimeType)) {
    throw new Error('imageMimeType должен быть image/jpeg, image/png или image/webp.');
  }

  return imageMimeType;
};

const parseGeminiBackendEstimateRequest = (rawValue: unknown): GeminiBackendEstimateRequest => {
  if (!isObjectRecord(rawValue)) {
    throw new Error('Тело запроса должно быть JSON-объектом.');
  }

  return {
    base64Image: parseBase64Image(rawValue.base64Image),
    imageMimeType: parseImageMimeType(rawValue.imageMimeType),
    sourceLabel: parseNonEmptyString(rawValue.sourceLabel, 'sourceLabel'),
  };
};

const parseCalories = (rawValue: unknown, fieldName: string): number => {
  const calories = parseNumber(rawValue, fieldName);

  if (calories < 0 || calories > maximumReasonableFoodCalories) {
    throw new Error(`${fieldName}: значение вне допустимого диапазона.`);
  }

  return Math.round(calories);
};

const parseConfidence = (rawValue: unknown): FoodCalorieConfidence => {
  if (rawValue === 'low' || rawValue === 'medium' || rawValue === 'high') {
    return rawValue;
  }

  throw new Error('confidence: неизвестное значение.');
};

const parseEstimateItems = (rawItems: unknown): FoodCalorieEstimateItem[] => {
  if (!Array.isArray(rawItems)) {
    throw new Error('items: ожидался список.');
  }

  const estimateItems: FoodCalorieEstimateItem[] = [];

  for (const rawItem of rawItems) {
    if (!isObjectRecord(rawItem)) {
      throw new Error('items: элемент должен быть объектом.');
    }

    estimateItems.push({
      calories: parseCalories(rawItem.calories, 'items.calories'),
      name: parseNonEmptyString(rawItem.name, 'items.name'),
    });
  }

  return estimateItems;
};

const parseFoodCalorieEstimate = (rawValue: unknown): FoodCalorieEstimate => {
  if (!isObjectRecord(rawValue)) {
    throw new Error('Gemini AI вернул не JSON-объект.');
  }

  return {
    calories: parseCalories(rawValue.calories, 'calories'),
    confidence: parseConfidence(rawValue.confidence),
    description: parseNonEmptyString(rawValue.description, 'description'),
    items: parseEstimateItems(rawValue.items),
    servingNotes: parseNonEmptyString(rawValue.servingNotes, 'servingNotes'),
  };
};

const createGeminiPrompt = (input: GeminiBackendEstimateRequest): string => {
  const promptLines = [
    'Оцени калорийность всей видимой съедобной еды на фото.',
    `Источник фото: ${input.sourceLabel}.`,
    'Используй изображение как главный источник данных.',
    'Если на фото фрукт, овощ, готовое блюдо, перекус или напиток с калориями, оцени суммарные килокалории порции.',
    'Если еды не видно, верни 0 калорий, confidence low, пустой список items и короткое объяснение.',
    'Не считай посуду, упаковку, напитки без калорий и фон.',
    'Пиши description, items.name и servingNotes по-русски.',
    'Укажи отдельные позиции еды в items, если их можно различить.',
  ];

  return promptLines.join(' ');
};

const extractGeminiOutputText = (responseBody: unknown): string => {
  if (!isObjectRecord(responseBody) || !Array.isArray(responseBody.candidates)) {
    throw new Error('Gemini AI вернул ответ в неизвестном формате.');
  }

  const firstCandidate = responseBody.candidates[0] as GeminiGenerateContentCandidate | undefined;
  const parts = firstCandidate?.content?.parts;

  if (!Array.isArray(parts)) {
    throw new Error('Gemini AI не вернул текст оценки калорий.');
  }

  const textParts: string[] = [];

  for (const part of parts) {
    if (typeof part.text === 'string' && part.text.trim().length > 0) {
      textParts.push(part.text.trim());
    }
  }

  if (textParts.length === 0) {
    throw new Error('Gemini AI не вернул текст оценки калорий.');
  }

  return textParts.join('\n');
};

const extractGeminiErrorMessage = (responseBody: unknown): string | null => {
  if (!isObjectRecord(responseBody)) {
    return null;
  }

  const errorRecord = isObjectRecord(responseBody.error) ? responseBody.error : null;
  return typeof errorRecord?.message === 'string' ? errorRecord.message : null;
};

const estimateFoodCaloriesWithGemini = async (input: GeminiBackendEstimateRequest): Promise<FoodCalorieEstimate> => {
  const response = await fetch(getGeminiGenerateContentUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: 'Ты точный калькулятор калорий по фото еды. Отвечай только валидным JSON по запрошенной схеме.',
          },
        ],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: createGeminiPrompt(input),
            },
            {
              inline_data: {
                mime_type: input.imageMimeType,
                data: input.base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: foodCalorieEstimateSchema,
        temperature: 0.2,
        maxOutputTokens: 700,
      },
    }),
  });

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch {
    throw new Error('Gemini AI вернул нечитабельный ответ.');
  }

  if (!response.ok) {
    throw new Error(extractGeminiErrorMessage(responseBody) ?? `Gemini AI не принял запрос: HTTP ${response.status}.`);
  }

  try {
    return parseFoodCalorieEstimate(JSON.parse(extractGeminiOutputText(responseBody)) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Gemini AI вернул нечитабельный JSON.');
    }

    throw error;
  }
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  let requestBody = '';
  let requestBodyBytes = 0;

  for await (const requestChunk of request) {
    const chunkBuffer = Buffer.isBuffer(requestChunk) ? requestChunk : Buffer.from(requestChunk);
    requestBodyBytes += chunkBuffer.byteLength;

    if (requestBodyBytes > maximumRequestBodyBytes) {
      throw new Error('Слишком большой запрос к backend.');
    }

    requestBody += chunkBuffer.toString('utf8');
  }

  if (requestBody.trim().length === 0) {
    throw new Error('Тело запроса пустое.');
  }

  return JSON.parse(requestBody) as unknown;
};

const writeJsonResponse = (response: ServerResponse, statusCode: number, responseBody: unknown): void => {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(responseBody));
};

const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  if (request.method === 'OPTIONS') {
    writeJsonResponse(response, 204, null);
    return;
  }

  if (request.method !== 'POST' || request.url !== '/food-calorie-estimate') {
    writeJsonResponse(response, 404, { message: 'Маршрут не найден.' });
    return;
  }

  try {
    const requestBody = await readJsonBody(request);
    const estimateRequest = parseGeminiBackendEstimateRequest(requestBody);
    const calorieEstimate = await estimateFoodCaloriesWithGemini(estimateRequest);
    writeJsonResponse(response, 200, calorieEstimate);
  } catch (error) {
    writeJsonResponse(response, 400, {
      message: error instanceof Error ? error.message : 'Backend не смог посчитать калории.',
    });
  }
};

const backendPort = getBackendPort();

createServer((request, response) => {
  void handleRequest(request, response);
}).listen(backendPort, () => {
  console.log(`Gemini calorie backend is listening on http://localhost:${backendPort}`);
});
