type IncomingMessage = import('node:http').IncomingMessage;
type ServerResponse = import('node:http').ServerResponse;

const { existsSync, readFileSync } = require('node:fs') as typeof import('node:fs');
const { createServer } = require('node:http') as typeof import('node:http');
const { join } = require('node:path') as typeof import('node:path');

type FoodCalorieConfidence = 'low' | 'medium' | 'high';

type DeepSeekBackendEstimateRequest = {
  query: string;
  recognitionModelLabel: string;
  recognitionProbability: number;
  recognizedLabel: string;
  servingGrams: number;
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

type DeepSeekChatCompletionChoice = {
  message?: {
    content?: unknown;
  };
};

const defaultDeepSeekApiUrl = 'https://api.deepseek.com/chat/completions';
const defaultDeepSeekFoodCalorieModel = 'deepseek-v4-flash';
const defaultBackendPort = 18000;
const maximumFoodServingGrams = 5000;
const maximumReasonableFoodCalories = 25000;
const maximumRequestBodyBytes = 256 * 1024;
const localDeepSeekEnvironmentFileName = 'deepseek.env';

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

const loadLocalDeepSeekEnvironmentFile = (): void => {
  const environmentFilePath = join(process.cwd(), localDeepSeekEnvironmentFileName);

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

loadLocalDeepSeekEnvironmentFile();

const getDeepSeekApiKey = (): string => {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY не задан на backend.');
  }

  return apiKey;
};

const getDeepSeekApiUrl = (): string => {
  const configuredApiUrl = process.env.DEEPSEEK_API_URL?.trim();
  return configuredApiUrl && configuredApiUrl.length > 0 ? configuredApiUrl : defaultDeepSeekApiUrl;
};

const getDeepSeekFoodCalorieModel = (): string => {
  const configuredModel = process.env.DEEPSEEK_FOOD_MODEL?.trim();
  return configuredModel && configuredModel.length > 0 ? configuredModel : defaultDeepSeekFoodCalorieModel;
};

const getBackendPort = (): number => {
  const configuredPort = Number(process.env.DEEPSEEK_BACKEND_PORT);
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

const parseServingGrams = (rawValue: unknown): number => {
  const servingGrams = parseNumber(rawValue, 'servingGrams');

  if (servingGrams <= 0 || servingGrams > maximumFoodServingGrams) {
    throw new Error(`servingGrams должен быть от 1 до ${maximumFoodServingGrams}.`);
  }

  return servingGrams;
};

const parseRecognitionProbability = (rawValue: unknown): number => {
  const recognitionProbability = parseNumber(rawValue, 'recognitionProbability');

  if (recognitionProbability < 0 || recognitionProbability > 1) {
    throw new Error('recognitionProbability должен быть от 0 до 1.');
  }

  return recognitionProbability;
};

const parseDeepSeekBackendEstimateRequest = (rawValue: unknown): DeepSeekBackendEstimateRequest => {
  if (!isObjectRecord(rawValue)) {
    throw new Error('Тело запроса должно быть JSON-объектом.');
  }

  return {
    query: parseNonEmptyString(rawValue.query, 'query'),
    recognitionModelLabel: parseNonEmptyString(rawValue.recognitionModelLabel, 'recognitionModelLabel'),
    recognitionProbability: parseRecognitionProbability(rawValue.recognitionProbability),
    recognizedLabel: parseNonEmptyString(rawValue.recognizedLabel, 'recognizedLabel'),
    servingGrams: parseServingGrams(rawValue.servingGrams),
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
    throw new Error('DeepSeek вернул не JSON-объект.');
  }

  return {
    calories: parseCalories(rawValue.calories, 'calories'),
    confidence: parseConfidence(rawValue.confidence),
    description: parseNonEmptyString(rawValue.description, 'description'),
    items: parseEstimateItems(rawValue.items),
    servingNotes: parseNonEmptyString(rawValue.servingNotes, 'servingNotes'),
  };
};

const createDeepSeekPrompt = (input: DeepSeekBackendEstimateRequest): string => {
  return [
    'Оцени калорийность еды после локального распознавания фото.',
    'Фото уже распознано на клиенте, поэтому используй только эти данные и типовые значения калорийности.',
    `Распознанная еда: ${input.recognizedLabel}.`,
    `Поисковое название: ${input.query}.`,
    `Метка модели распознавания: ${input.recognitionModelLabel}.`,
    `Вероятность распознавания: ${Math.round(input.recognitionProbability * 100)}%.`,
    `Ориентировочный вес порции: ${Math.round(input.servingGrams)} г.`,
    'Верни только JSON без Markdown.',
    'Формат JSON: {"calories": number, "confidence": "low" | "medium" | "high", "description": string, "items": [{"name": string, "calories": number}], "servingNotes": string}.',
    'Пиши description, items.name и servingNotes по-русски.',
    'Если блюдо распознано слишком общо, используй confidence low или medium и объясни неопределенность в servingNotes.',
  ].join(' ');
};

const extractDeepSeekOutputText = (responseBody: unknown): string => {
  if (!isObjectRecord(responseBody) || !Array.isArray(responseBody.choices)) {
    throw new Error('DeepSeek вернул ответ в неизвестном формате.');
  }

  const firstChoice = responseBody.choices[0] as DeepSeekChatCompletionChoice | undefined;
  const rawContent = firstChoice?.message?.content;

  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    throw new Error('DeepSeek не вернул текст оценки калорий.');
  }

  return rawContent.trim();
};

const extractDeepSeekErrorMessage = (responseBody: unknown): string | null => {
  if (!isObjectRecord(responseBody)) {
    return null;
  }

  const errorRecord = isObjectRecord(responseBody.error) ? responseBody.error : null;
  return typeof errorRecord?.message === 'string' ? errorRecord.message : null;
};

const estimateFoodCaloriesWithDeepSeek = async (input: DeepSeekBackendEstimateRequest): Promise<FoodCalorieEstimate> => {
  const response = await fetch(getDeepSeekApiUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getDeepSeekApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getDeepSeekFoodCalorieModel(),
      messages: [
        {
          role: 'system',
          content: 'Ты точный калькулятор калорий. Отвечай только валидным JSON по запрошенному формату.',
        },
        {
          role: 'user',
          content: createDeepSeekPrompt(input),
        },
      ],
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 600,
      stream: false,
    }),
  });

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch {
    throw new Error('DeepSeek вернул нечитабельный ответ.');
  }

  if (!response.ok) {
    throw new Error(extractDeepSeekErrorMessage(responseBody) ?? `DeepSeek не принял запрос: HTTP ${response.status}.`);
  }

  return parseFoodCalorieEstimate(JSON.parse(extractDeepSeekOutputText(responseBody)) as unknown);
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
    const estimateRequest = parseDeepSeekBackendEstimateRequest(requestBody);
    const calorieEstimate = await estimateFoodCaloriesWithDeepSeek(estimateRequest);
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
  console.log(`DeepSeek calorie backend is listening on http://localhost:${backendPort}`);
});
