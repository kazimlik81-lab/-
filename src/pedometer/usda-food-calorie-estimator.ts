import {
  defaultUsdaFoodDataCentralApiKey,
  maximumFoodServingGrams,
  maximumReasonableFoodCalories,
  usdaFoodDataCentralSearchUrl,
} from 'src/pedometer/constants';
import type { FoodCalorieConfidence, FoodCalorieEstimate } from 'src/pedometer/types';

declare const process: {
  env?: {
    EXPO_PUBLIC_USDA_FDC_API_KEY?: string;
  };
};

type UsdaFoodCalorieEstimationInput = {
  query: string;
  servingGrams: number;
};

type UsdaFoodCandidate = {
  dataType: string;
  description: string;
  fdcId: string;
  kcalPer100g: number;
};

const preferredUsdaDataTypes = ['Survey (FNDDS)', 'Foundation', 'SR Legacy', 'Branded'];
const localFallbackDataType = 'Local fallback';

const localFoodCalorieRecords: UsdaFoodCandidate[] = [
  { dataType: localFallbackDataType, description: 'Ананас, среднее значение', fdcId: 'local-pineapple', kcalPer100g: 50 },
  { dataType: localFallbackDataType, description: 'Апельсин, среднее значение', fdcId: 'local-orange', kcalPer100g: 47 },
  { dataType: localFallbackDataType, description: 'Бейгл, среднее значение', fdcId: 'local-bagel', kcalPer100g: 257 },
  { dataType: localFallbackDataType, description: 'Банан, среднее значение', fdcId: 'local-banana', kcalPer100g: 89 },
  { dataType: localFallbackDataType, description: 'Бенто, среднее значение', fdcId: 'local-bento', kcalPer100g: 160 },
  { dataType: localFallbackDataType, description: 'Брокколи, среднее значение', fdcId: 'local-broccoli', kcalPer100g: 35 },
  { dataType: localFallbackDataType, description: 'Бургер, среднее значение', fdcId: 'local-burger', kcalPer100g: 295 },
  { dataType: localFallbackDataType, description: 'Говядина, среднее значение', fdcId: 'local-beef', kcalPer100g: 250 },
  { dataType: localFallbackDataType, description: 'Гречка вареная, среднее значение', fdcId: 'local-buckwheat', kcalPer100g: 110 },
  { dataType: localFallbackDataType, description: 'Грибы, среднее значение', fdcId: 'local-mushroom', kcalPer100g: 22 },
  { dataType: localFallbackDataType, description: 'Гуакамоле, среднее значение', fdcId: 'local-guacamole', kcalPer100g: 150 },
  { dataType: localFallbackDataType, description: 'Кола, среднее значение', fdcId: 'local-cola', kcalPer100g: 42 },
  { dataType: localFallbackDataType, description: 'Инжир, среднее значение', fdcId: 'local-fig', kcalPer100g: 74 },
  { dataType: localFallbackDataType, description: 'Кофе с молоком, среднее значение', fdcId: 'local-coffee', kcalPer100g: 45 },
  { dataType: localFallbackDataType, description: 'Картофель, среднее значение', fdcId: 'local-potato', kcalPer100g: 87 },
  { dataType: localFallbackDataType, description: 'Клубника, среднее значение', fdcId: 'local-strawberry', kcalPer100g: 32 },
  { dataType: localFallbackDataType, description: 'Крендель, среднее значение', fdcId: 'local-pretzel', kcalPer100g: 380 },
  { dataType: localFallbackDataType, description: 'Кус-кус вареный, среднее значение', fdcId: 'local-couscous', kcalPer100g: 112 },
  { dataType: localFallbackDataType, description: 'Куриная грудка, среднее значение', fdcId: 'local-chicken', kcalPer100g: 165 },
  { dataType: localFallbackDataType, description: 'Лимон, среднее значение', fdcId: 'local-lemon', kcalPer100g: 29 },
  { dataType: localFallbackDataType, description: 'Макароны вареные, среднее значение', fdcId: 'local-pasta', kcalPer100g: 158 },
  { dataType: localFallbackDataType, description: 'Обед, среднее значение', fdcId: 'local-meal', kcalPer100g: 180 },
  { dataType: localFallbackDataType, description: 'Мясной рулет, среднее значение', fdcId: 'local-meat-loaf', kcalPer100g: 240 },
  { dataType: localFallbackDataType, description: 'Мороженое, среднее значение', fdcId: 'local-ice-cream', kcalPer100g: 207 },
  { dataType: localFallbackDataType, description: 'Огурец, среднее значение', fdcId: 'local-cucumber', kcalPer100g: 15 },
  { dataType: localFallbackDataType, description: 'Овсянка, среднее значение', fdcId: 'local-oatmeal', kcalPer100g: 68 },
  { dataType: localFallbackDataType, description: 'Перец сладкий, среднее значение', fdcId: 'local-bell-pepper', kcalPer100g: 31 },
  { dataType: localFallbackDataType, description: 'Печенье, среднее значение', fdcId: 'local-cookie', kcalPer100g: 488 },
  { dataType: localFallbackDataType, description: 'Пицца, среднее значение', fdcId: 'local-pizza', kcalPer100g: 266 },
  { dataType: localFallbackDataType, description: 'Пончики, среднее значение', fdcId: 'local-doughnut', kcalPer100g: 452 },
  { dataType: localFallbackDataType, description: 'Пирог, среднее значение', fdcId: 'local-pie', kcalPer100g: 260 },
  { dataType: localFallbackDataType, description: 'Гранат, среднее значение', fdcId: 'local-pomegranate', kcalPer100g: 83 },
  { dataType: localFallbackDataType, description: 'Рис вареный, среднее значение', fdcId: 'local-rice', kcalPer100g: 130 },
  { dataType: localFallbackDataType, description: 'Рыба, среднее значение', fdcId: 'local-fish', kcalPer100g: 206 },
  { dataType: localFallbackDataType, description: 'Салат овощной, среднее значение', fdcId: 'local-salad', kcalPer100g: 33 },
  { dataType: localFallbackDataType, description: 'Суп, среднее значение', fdcId: 'local-soup', kcalPer100g: 50 },
  { dataType: localFallbackDataType, description: 'Суши, среднее значение', fdcId: 'local-sushi', kcalPer100g: 150 },
  { dataType: localFallbackDataType, description: 'Сыр, среднее значение', fdcId: 'local-cheese', kcalPer100g: 402 },
  { dataType: localFallbackDataType, description: 'Сок, среднее значение', fdcId: 'local-juice', kcalPer100g: 45 },
  { dataType: localFallbackDataType, description: 'Хлеб, среднее значение', fdcId: 'local-bread', kcalPer100g: 265 },
  { dataType: localFallbackDataType, description: 'Хот-дог, среднее значение', fdcId: 'local-hot-dog', kcalPer100g: 290 },
  { dataType: localFallbackDataType, description: 'Фрукты, среднее значение', fdcId: 'local-fruit', kcalPer100g: 60 },
  { dataType: localFallbackDataType, description: 'Овощи, среднее значение', fdcId: 'local-vegetable', kcalPer100g: 35 },
  { dataType: localFallbackDataType, description: 'Суп фо, среднее значение', fdcId: 'local-pho', kcalPer100g: 80 },
  { dataType: localFallbackDataType, description: 'Цветная капуста, среднее значение', fdcId: 'local-cauliflower', kcalPer100g: 25 },
  { dataType: localFallbackDataType, description: 'Чизбургер, среднее значение', fdcId: 'local-cheeseburger', kcalPer100g: 303 },
  { dataType: localFallbackDataType, description: 'Шаурма, среднее значение', fdcId: 'local-shawarma', kcalPer100g: 250 },
  { dataType: localFallbackDataType, description: 'Торт, среднее значение', fdcId: 'local-cake', kcalPer100g: 350 },
  { dataType: localFallbackDataType, description: 'Вино, среднее значение', fdcId: 'local-wine', kcalPer100g: 83 },
  { dataType: localFallbackDataType, description: 'Яблоко, среднее значение', fdcId: 'local-apple', kcalPer100g: 52 },
  { dataType: localFallbackDataType, description: 'Яйцо, среднее значение', fdcId: 'local-egg', kcalPer100g: 155 },
  { dataType: localFallbackDataType, description: 'Кабачок, среднее значение', fdcId: 'local-zucchini', kcalPer100g: 17 },
];

const localFoodSearchTermsByFdcId: Record<string, string[]> = {
  'local-apple': ['apple', 'яблоко'],
  'local-banana': ['banana', 'банан'],
  'local-bagel': ['bagel', 'бейгл'],
  'local-beef': ['beef', 'говядина'],
  'local-bell-pepper': ['bell pepper', 'перец'],
  'local-bento': ['bento', 'бенто'],
  'local-bread': ['bread', 'хлеб'],
  'local-broccoli': ['broccoli', 'брокколи'],
  'local-buckwheat': ['buckwheat', 'гречка'],
  'local-burger': ['burger', 'hamburger', 'бургер', 'гамбургер'],
  'local-cauliflower': ['cauliflower', 'цветная капуста'],
  'local-cake': ['cake', 'торт'],
  'local-cheese': ['cheese', 'сыр'],
  'local-cheeseburger': ['cheeseburger', 'чизбургер'],
  'local-chicken': ['chicken', 'курица'],
  'local-cola': ['cola', 'кола'],
  'local-coffee': ['coffee', 'cappuccino', 'кофе', 'капучино'],
  'local-cookie': ['cookie', 'печенье'],
  'local-couscous': ['couscous', 'кус-кус', 'кускус'],
  'local-cucumber': ['cucumber', 'огурец'],
  'local-doughnut': ['doughnut', 'donut', 'пончик'],
  'local-egg': ['egg', 'яйцо', 'омлет'],
  'local-fig': ['fig', 'инжир'],
  'local-fish': ['fish', 'рыба'],
  'local-guacamole': ['guacamole', 'гуакамоле'],
  'local-hot-dog': ['hot dog', 'hotdog', 'хот-дог'],
  'local-ice-cream': ['ice cream', 'мороженое'],
  'local-juice': ['juice', 'сок'],
  'local-lemon': ['lemon', 'лимон'],
  'local-meal': ['meal', 'lunch', 'supper', 'cuisine', 'food', 'еда', 'обед'],
  'local-meat-loaf': ['meat loaf', 'meatloaf', 'мясной рулет'],
  'local-mushroom': ['mushroom', 'грибы'],
  'local-oatmeal': ['oatmeal', 'овсянка'],
  'local-orange': ['orange', 'апельсин'],
  'local-pasta': ['pasta', 'макароны', 'паста'],
  'local-pineapple': ['pineapple', 'ананас'],
  'local-pizza': ['pizza', 'пицца'],
  'local-pho': ['pho', 'фо'],
  'local-pie': ['pie', 'пирог'],
  'local-potato': ['potato', 'картофель', 'картошка'],
  'local-pomegranate': ['pomegranate', 'гранат'],
  'local-pretzel': ['pretzel', 'крендель'],
  'local-rice': ['rice', 'cooked rice', 'рис'],
  'local-salad': ['salad', 'салат'],
  'local-shawarma': ['shawarma', 'шаурма'],
  'local-soup': ['soup', 'суп'],
  'local-strawberry': ['strawberry', 'клубника'],
  'local-sushi': ['sushi', 'суши'],
  'local-fruit': ['fruit', 'фрукты'],
  'local-vegetable': ['vegetable', 'овощи'],
  'local-wine': ['wine', 'вино'],
  'local-zucchini': ['zucchini', 'courgette', 'кабачок'],
};

const russianFoodQueryTranslations: Record<string, string> = {
  ананас: 'pineapple',
  апельсин: 'orange',
  бейгл: 'bagel',
  банан: 'banana',
  бенто: 'bento',
  брокколи: 'broccoli',
  бургер: 'burger',
  вино: 'wine',
  говядина: 'beef',
  гречка: 'buckwheat',
  грибы: 'mushroom',
  гуакамоле: 'guacamole',
  гамбургер: 'hamburger',
  гранат: 'pomegranate',
  инжир: 'fig',
  кабачок: 'zucchini',
  капучино: 'cappuccino',
  картофель: 'potato',
  картошка: 'potato',
  клубника: 'strawberry',
  кола: 'cola',
  кофе: 'coffee',
  крендель: 'pretzel',
  кускус: 'couscous',
  'кус-кус': 'couscous',
  курица: 'chicken',
  лимон: 'lemon',
  макароны: 'pasta',
  'мясной рулет': 'meat loaf',
  мороженое: 'ice cream',
  обед: 'meal',
  огурец: 'cucumber',
  омлет: 'omelet',
  овощи: 'vegetable',
  паста: 'pasta',
  печенье: 'cookie',
  перец: 'bell pepper',
  пирог: 'pie',
  пицца: 'pizza',
  пончик: 'doughnut',
  рис: 'cooked rice',
  рыба: 'fish',
  салат: 'salad',
  суп: 'soup',
  фо: 'pho',
  фрукты: 'fruit',
  суши: 'sushi',
  сыр: 'cheese',
  торт: 'cake',
  хлеб: 'bread',
  хотдог: 'hot dog',
  'хот-дог': 'hot dog',
  'цветная капуста': 'cauliflower',
  чизбургер: 'cheeseburger',
  шаурма: 'shawarma',
  яблоко: 'apple',
  яйцо: 'egg',
};

const normalizeFoodSearchQuery = (rawQuery: string): string => {
  const trimmedQuery = rawQuery.trim().replace(/\s+/g, ' ');

  if (trimmedQuery.length === 0) {
    throw new Error('Введите название еды.');
  }

  return russianFoodQueryTranslations[trimmedQuery.toLocaleLowerCase('ru-RU')] ?? trimmedQuery;
};

const normalizeServingGrams = (servingGrams: number): number => {
  if (!Number.isFinite(servingGrams) || servingGrams <= 0) {
    throw new Error('Введите вес порции больше 0 г.');
  }

  if (servingGrams > maximumFoodServingGrams) {
    throw new Error(`Введите вес порции до ${maximumFoodServingGrams} г.`);
  }

  return servingGrams;
};

const getUsdaApiKey = (): string => {
  const configuredApiKey = process.env?.EXPO_PUBLIC_USDA_FDC_API_KEY?.trim();
  return configuredApiKey && configuredApiKey.length > 0 ? configuredApiKey : defaultUsdaFoodDataCentralApiKey;
};

const getObjectRecord = (value: unknown): Record<string, unknown> | null => {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
};

const parseStringField = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const parseNumberField = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const getFoodEnergyKcalPer100g = (rawFood: Record<string, unknown>): number | null => {
  if (!Array.isArray(rawFood.foodNutrients)) {
    return null;
  }

  for (const rawNutrient of rawFood.foodNutrients) {
    const nutrient = getObjectRecord(rawNutrient);

    if (!nutrient) {
      continue;
    }

    const nutrientName = parseStringField(nutrient.nutrientName)?.toLocaleLowerCase('en-US');
    const nutrientNumber = parseStringField(nutrient.nutrientNumber);
    const unitName = parseStringField(nutrient.unitName)?.toLocaleUpperCase('en-US');
    const value = parseNumberField(nutrient.value);
    const isEnergyKcal = (nutrientName === 'energy' || nutrientNumber === '208') && unitName === 'KCAL';

    if (isEnergyKcal && value !== null && value >= 0) {
      return value;
    }
  }

  return null;
};

const getDataTypePriority = (dataType: string): number => {
  const priorityIndex = preferredUsdaDataTypes.indexOf(dataType);
  return priorityIndex === -1 ? preferredUsdaDataTypes.length : priorityIndex;
};

const parseUsdaFoodCandidate = (rawFood: unknown): UsdaFoodCandidate | null => {
  const food = getObjectRecord(rawFood);

  if (!food) {
    return null;
  }

  const description = parseStringField(food.description);
  const dataType = parseStringField(food.dataType);
  const fdcId = parseNumberField(food.fdcId)?.toFixed(0) ?? parseStringField(food.fdcId);
  const kcalPer100g = getFoodEnergyKcalPer100g(food);

  if (!description || !dataType || !fdcId || kcalPer100g === null) {
    return null;
  }

  return {
    dataType,
    description,
    fdcId,
    kcalPer100g,
  };
};

const selectBestUsdaFoodCandidate = (rawFoods: unknown): UsdaFoodCandidate => {
  if (!Array.isArray(rawFoods)) {
    throw new Error('USDA вернула неизвестный формат списка еды.');
  }

  const candidates: UsdaFoodCandidate[] = [];

  for (const rawFood of rawFoods) {
    const candidate = parseUsdaFoodCandidate(rawFood);

    if (candidate) {
      candidates.push(candidate);
    }
  }

  candidates.sort((leftCandidate, rightCandidate) => {
    const dataTypePriorityDifference = getDataTypePriority(leftCandidate.dataType) - getDataTypePriority(rightCandidate.dataType);

    if (dataTypePriorityDifference !== 0) {
      return dataTypePriorityDifference;
    }

    return leftCandidate.description.length - rightCandidate.description.length;
  });

  const bestCandidate = candidates[0];

  if (!bestCandidate) {
    throw new Error('USDA не нашла калорийность для этой еды.');
  }

  return bestCandidate;
};

const getConfidenceForDataType = (dataType: string): FoodCalorieConfidence => {
  return dataType === 'Branded' ? 'low' : 'medium';
};

const createUsdaSearchUrl = (query: string, usdaApiKey: string): string => {
  const searchParameters = [
    `api_key=${encodeURIComponent(usdaApiKey)}`,
    `query=${encodeURIComponent(query)}`,
    'pageSize=50',
  ];

  return `${usdaFoodDataCentralSearchUrl}?${searchParameters.join('&')}`;
};

const parseUsdaErrorMessage = async (response: Response): Promise<string> => {
  if (response.status === 429) {
    return 'USDA DEMO_KEY достиг лимита запросов. Добавьте EXPO_PUBLIC_USDA_FDC_API_KEY или попробуйте позже.';
  }

  try {
    const responseBody: unknown = await response.json();
    const responseRecord = getObjectRecord(responseBody);
    const errorRecord = responseRecord ? getObjectRecord(responseRecord.error) : null;
    const errorMessage = responseRecord
      ? parseStringField(responseRecord.message) ?? parseStringField(responseRecord.error) ?? (errorRecord ? parseStringField(errorRecord.message) : null)
      : null;

    return errorMessage ?? `USDA не приняла запрос: HTTP ${response.status}.`;
  } catch {
    return `USDA не приняла запрос: HTTP ${response.status}.`;
  }
};

const findLocalFoodCandidate = (rawQuery: string, normalizedQuery: string): UsdaFoodCandidate | null => {
  const queryVariants = [rawQuery, normalizedQuery].map((query) => query.trim().toLocaleLowerCase('ru-RU')).filter((query) => query.length > 0);

  for (const localFoodCalorieRecord of localFoodCalorieRecords) {
    const searchTerms = localFoodSearchTermsByFdcId[localFoodCalorieRecord.fdcId] ?? [];

    for (const searchTerm of searchTerms) {
      const normalizedSearchTerm = searchTerm.toLocaleLowerCase('ru-RU');
      const hasMatchingQuery = queryVariants.some((queryVariant) => queryVariant === normalizedSearchTerm || queryVariant.includes(normalizedSearchTerm));

      if (hasMatchingQuery) {
        return localFoodCalorieRecord;
      }
    }
  }

  return null;
};

const createFoodCalorieEstimate = (selectedFood: UsdaFoodCandidate, servingGrams: number): FoodCalorieEstimate => {
  const calories = Math.round((selectedFood.kcalPer100g * servingGrams) / 100);

  if (calories > maximumReasonableFoodCalories) {
    throw new Error('Расчет калорий получился вне допустимого диапазона.');
  }

  const roundedServingGrams = Math.round(servingGrams);
  const roundedKcalPer100g = Math.round(selectedFood.kcalPer100g);
  const sourceNote = selectedFood.dataType === localFallbackDataType
    ? `Встроенный локальный справочник: ${roundedKcalPer100g} ккал на 100 г. Вес порции оценен автоматически.`
    : `Расчет по базе USDA FoodData Central: ${roundedKcalPer100g} ккал на 100 г, источник ${selectedFood.dataType}, FDC ${selectedFood.fdcId}. Вес порции оценен автоматически.`;

  return {
    calories,
    confidence: getConfidenceForDataType(selectedFood.dataType),
    description: selectedFood.dataType === localFallbackDataType ? selectedFood.description : `USDA: ${selectedFood.description}`,
    items: [
      {
        name: `${selectedFood.description}, ${roundedServingGrams} г`,
        calories,
      },
    ],
    servingNotes: sourceNote,
  };
};

export const estimateFoodCaloriesLocally = (input: UsdaFoodCalorieEstimationInput): FoodCalorieEstimate => {
  const query = normalizeFoodSearchQuery(input.query);
  const servingGrams = normalizeServingGrams(input.servingGrams);
  const localFoodCandidate = findLocalFoodCandidate(input.query, query);

  if (!localFoodCandidate) {
    throw new Error('Во встроенном справочнике нет такой еды. Уточните название.');
  }

  return createFoodCalorieEstimate(localFoodCandidate, servingGrams);
};

export const estimateFoodCaloriesFromUsda = async (input: UsdaFoodCalorieEstimationInput): Promise<FoodCalorieEstimate> => {
  const query = normalizeFoodSearchQuery(input.query);
  const servingGrams = normalizeServingGrams(input.servingGrams);
  const usdaApiKey = getUsdaApiKey();
  const localFallbackCandidate = findLocalFoodCandidate(input.query, query);
  let response: Response;

  try {
    response = await fetch(createUsdaSearchUrl(query, usdaApiKey));
  } catch (error) {
    if (localFallbackCandidate) {
      return createFoodCalorieEstimate(localFallbackCandidate, servingGrams);
    }

    throw error;
  }

  if (!response.ok) {
    if (localFallbackCandidate) {
      return createFoodCalorieEstimate(localFallbackCandidate, servingGrams);
    }

    throw new Error(await parseUsdaErrorMessage(response));
  }

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch {
    throw new Error('USDA вернула нечитабельный ответ.');
  }

  const responseRecord = getObjectRecord(responseBody);

  if (!responseRecord) {
    throw new Error('USDA вернула неизвестный формат ответа.');
  }

  try {
    const selectedFood = selectBestUsdaFoodCandidate(responseRecord.foods);
    return createFoodCalorieEstimate(selectedFood, servingGrams);
  } catch (error) {
    if (localFallbackCandidate) {
      return createFoodCalorieEstimate(localFallbackCandidate, servingGrams);
    }

    throw error;
  }
};
