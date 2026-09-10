import { Platform } from 'react-native';

import { isAndroidNativeFoodImageLabelerAvailable, recognizeAndroidFoodImageLabels } from 'src/pedometer/native-food-image-labeler';
import type { FoodCalorieConfidence } from 'src/pedometer/types';

type FoodPhotoAutoRecognitionInput = {
  base64Jpeg?: string;
  fileName?: string | null;
  sourceLabel: string;
  uri: string;
};

type FoodPhotoAutoRecognition = {
  confidence: FoodCalorieConfidence;
  label: string;
  modelLabel: string;
  probability: number;
  query: string;
  servingGrams: number;
};

type FoodRecognitionRule = {
  keywords: string[];
  label: string;
  maximumConfidence?: FoodCalorieConfidence;
  priority?: number;
  query: string;
  servingGrams: number;
};

type MobileNetPrediction = {
  className: string;
  probability: number;
};

type MobileNetModel = {
  classify: (image: HTMLImageElement, topK?: number) => Promise<MobileNetPrediction[]>;
};

const foodRecognitionRules: FoodRecognitionRule[] = [
  { keywords: ['cheeseburger'], label: 'чизбургер', priority: 1.6, query: 'cheeseburger', servingGrams: 220 },
  { keywords: ['hamburger', 'burger'], label: 'бургер', priority: 1.5, query: 'burger', servingGrams: 220 },
  { keywords: ['fast food'], label: 'фастфуд', maximumConfidence: 'medium', priority: 1.25, query: 'burger', servingGrams: 250 },
  { keywords: ['hotdog', 'hot dog', 'red hot'], label: 'хот-дог', priority: 1.5, query: 'hot dog', servingGrams: 150 },
  { keywords: ['pizza', 'pizza pie'], label: 'пицца', priority: 1.5, query: 'pizza', servingGrams: 180 },
  { keywords: ['carbonara', 'spaghetti', 'pasta'], label: 'паста', query: 'pasta', servingGrams: 250 },
  { keywords: ['bento'], label: 'бенто', query: 'bento', servingGrams: 350 },
  { keywords: ['couscous'], label: 'кус-кус', query: 'couscous', servingGrams: 200 },
  { keywords: ['bagel'], label: 'бейгл', query: 'bagel', servingGrams: 100 },
  { keywords: ['pretzel'], label: 'крендель', query: 'pretzel', servingGrams: 70 },
  { keywords: ['french loaf', 'loaf', 'bread'], label: 'хлеб', query: 'bread', servingGrams: 80 },
  { keywords: ['cookie'], label: 'печенье', query: 'cookie', servingGrams: 50 },
  { keywords: ['cake', 'icing', 'trifle'], label: 'торт', query: 'cake', servingGrams: 120 },
  { keywords: ['pie', 'pasteles'], label: 'пирог', query: 'pie', servingGrams: 140 },
  { keywords: ['banana'], label: 'банан', query: 'banana', servingGrams: 120 },
  { keywords: ['granny smith', 'apple'], label: 'яблоко', query: 'apple', servingGrams: 180 },
  { keywords: ['fruit'], label: 'фрукты', maximumConfidence: 'medium', query: 'fruit', servingGrams: 180 },
  { keywords: ['orange'], label: 'апельсин', query: 'orange', servingGrams: 180 },
  { keywords: ['lemon'], label: 'лимон', query: 'lemon', servingGrams: 100 },
  { keywords: ['pineapple', 'ananas'], label: 'ананас', query: 'pineapple', servingGrams: 160 },
  { keywords: ['strawberry'], label: 'клубника', query: 'strawberry', servingGrams: 150 },
  { keywords: ['pomegranate'], label: 'гранат', query: 'pomegranate', servingGrams: 170 },
  { keywords: ['fig'], label: 'инжир', query: 'fig', servingGrams: 100 },
  { keywords: ['ice cream', 'icecream', 'gelato'], label: 'мороженое', query: 'ice cream', servingGrams: 150 },
  { keywords: ['guacamole'], label: 'гуакамоле', query: 'guacamole', servingGrams: 100 },
  { keywords: ['consomme', 'soup'], label: 'суп', query: 'soup', servingGrams: 300 },
  { keywords: ['pho'], label: 'суп фо', query: 'pho', servingGrams: 450 },
  { keywords: ['broccoli'], label: 'брокколи', query: 'broccoli', servingGrams: 150 },
  { keywords: ['cauliflower'], label: 'цветная капуста', query: 'cauliflower', servingGrams: 150 },
  { keywords: ['bell pepper'], label: 'перец', query: 'bell pepper', servingGrams: 120 },
  { keywords: ['cucumber', 'cuke'], label: 'огурец', query: 'cucumber', servingGrams: 150 },
  { keywords: ['zucchini', 'courgette'], label: 'кабачок', query: 'zucchini', servingGrams: 180 },
  { keywords: ['vegetable'], label: 'овощи', maximumConfidence: 'medium', query: 'vegetable', servingGrams: 180 },
  { keywords: ['mushroom'], label: 'грибы', query: 'mushroom', servingGrams: 150 },
  { keywords: ['mashed potato', 'potato'], label: 'картофель', query: 'potato', servingGrams: 200 },
  { keywords: ['salad'], label: 'салат', query: 'salad', servingGrams: 250 },
  { keywords: ['sushi'], label: 'суши', query: 'sushi', servingGrams: 180 },
  { keywords: ['shawarma'], label: 'шаурма', query: 'shawarma', servingGrams: 300 },
  { keywords: ['egg', 'omelet', 'omelette'], label: 'яйцо', query: 'egg', servingGrams: 100 },
  { keywords: ['chicken'], label: 'курица', query: 'chicken', servingGrams: 180 },
  { keywords: ['fish'], label: 'рыба', query: 'fish', servingGrams: 180 },
  { keywords: ['rice'], label: 'рис', query: 'cooked rice', servingGrams: 200 },
  { keywords: ['juice'], label: 'сок', maximumConfidence: 'medium', priority: 0.8, query: 'juice', servingGrams: 250 },
  { keywords: ['cola'], label: 'кола', maximumConfidence: 'medium', priority: 0.7, query: 'cola', servingGrams: 330 },
  { keywords: ['coffee', 'cappuccino'], label: 'кофе', maximumConfidence: 'medium', priority: 0.7, query: 'coffee', servingGrams: 250 },
  { keywords: ['wine'], label: 'вино', maximumConfidence: 'medium', priority: 0.6, query: 'wine', servingGrams: 150 },
  { keywords: ['meal', 'lunch', 'supper', 'cuisine', 'food', 'eating'], label: 'еда', maximumConfidence: 'low', priority: 0.45, query: 'meal', servingGrams: 250 },
];

let mobileNetModelPromise: Promise<MobileNetModel> | null = null;

const confidenceOrder: Record<FoodCalorieConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const getRecognitionConfidence = (probability: number): FoodCalorieConfidence => {
  if (probability >= 0.75) {
    return 'high';
  }

  if (probability >= 0.4) {
    return 'medium';
  }

  return 'low';
};

const capConfidence = (
  confidence: FoodCalorieConfidence,
  maximumConfidence: FoodCalorieConfidence | undefined,
): FoodCalorieConfidence => {
  if (!maximumConfidence) {
    return confidence;
  }

  return confidenceOrder[confidence] <= confidenceOrder[maximumConfidence] ? confidence : maximumConfidence;
};

const findFoodRecognitionRule = (rawText: string): FoodRecognitionRule | null => {
  const normalizedText = rawText.toLocaleLowerCase('en-US');

  for (const foodRecognitionRule of foodRecognitionRules) {
    const hasMatchingKeyword = foodRecognitionRule.keywords.some((keyword) => normalizedText.includes(keyword));

    if (hasMatchingKeyword) {
      return foodRecognitionRule;
    }
  }

  return null;
};

const createRecognitionFromRule = (
  foodRecognitionRule: FoodRecognitionRule,
  modelLabel: string,
  probability: number,
): FoodPhotoAutoRecognition => {
  return {
    confidence: capConfidence(getRecognitionConfidence(probability), foodRecognitionRule.maximumConfidence),
    label: foodRecognitionRule.label,
    modelLabel,
    probability,
    query: foodRecognitionRule.query,
    servingGrams: foodRecognitionRule.servingGrams,
  };
};

const createRecognitionFromPredictions = (
  predictions: MobileNetPrediction[],
  modelLabelPrefix?: string,
): FoodPhotoAutoRecognition | null => {
  let bestPrediction: MobileNetPrediction | null = null;
  let bestRule: FoodRecognitionRule | null = null;
  let bestScore = 0;

  for (const prediction of predictions) {
    const foodRecognitionRule = findFoodRecognitionRule(prediction.className);

    if (!foodRecognitionRule) {
      continue;
    }

    const score = prediction.probability * (foodRecognitionRule.priority ?? 1);

    if (score > bestScore) {
      bestPrediction = prediction;
      bestRule = foodRecognitionRule;
      bestScore = score;
    }
  }

  if (!bestPrediction || !bestRule) {
    return null;
  }

  const modelLabel = modelLabelPrefix ? `${modelLabelPrefix}: ${bestPrediction.className}` : bestPrediction.className;
  return createRecognitionFromRule(bestRule, modelLabel, bestPrediction.probability);
};

const recognizeFoodFromFileName = (fileName: string | null | undefined): FoodPhotoAutoRecognition | null => {
  if (!fileName) {
    return null;
  }

  const fileNameRule = findFoodRecognitionRule(fileName.replace(/[_-]/g, ' '));

  return fileNameRule ? createRecognitionFromRule(fileNameRule, `имя файла: ${fileName}`, 0.35) : null;
};

const loadBrowserImage = (uri: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = document.createElement('img');

    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось подготовить фото для автораспознавания.'));
    image.src = uri;
  });
};

const loadMobileNetModel = async (): Promise<MobileNetModel> => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('Автораспознавание фото недоступно в этой сборке приложения.');
  }

  if (!mobileNetModelPromise) {
    mobileNetModelPromise = (async () => {
      const tensorflowCore = await import('@tensorflow/tfjs-core');
      await import('@tensorflow/tfjs-converter');
      await import('@tensorflow/tfjs-backend-webgl');
      await import('@tensorflow/tfjs-backend-cpu');
      const isWebGlBackendReady = await tensorflowCore.setBackend('webgl').catch(() => false);

      if (!isWebGlBackendReady) {
        await tensorflowCore.setBackend('cpu');
      }

      await tensorflowCore.ready();
      const mobileNetModule = await import('@tensorflow-models/mobilenet');
      return mobileNetModule.load({ version: 2, alpha: 1.0 });
    })();
  }

  return mobileNetModelPromise;
};

const recognizeFoodWithAndroidLabeler = async (
  input: FoodPhotoAutoRecognitionInput,
): Promise<FoodPhotoAutoRecognition | null> => {
  if (Platform.OS !== 'android' || !input.base64Jpeg || !isAndroidNativeFoodImageLabelerAvailable()) {
    return null;
  }

  const nativeLabels = await recognizeAndroidFoodImageLabels(input.base64Jpeg);
  const predictions = nativeLabels.map((nativeLabel) => ({
    className: nativeLabel.text,
    probability: nativeLabel.confidence,
  }));

  return createRecognitionFromPredictions(predictions, 'ML Kit');
};

export const recognizeFoodPhotoAutomatically = async (
  input: FoodPhotoAutoRecognitionInput,
): Promise<FoodPhotoAutoRecognition> => {
  const fileNameRecognition = recognizeFoodFromFileName(input.fileName);

  if (Platform.OS === 'android') {
    try {
      const nativeRecognition = await recognizeFoodWithAndroidLabeler(input);

      if (nativeRecognition) {
        return nativeRecognition;
      }
    } catch (error) {
      if (fileNameRecognition) {
        return fileNameRecognition;
      }

      throw error;
    }

    if (fileNameRecognition) {
      return fileNameRecognition;
    }

    throw new Error(`Не удалось автоматически понять еду по ${input.sourceLabel}.`);
  }

  try {
    const mobileNetModel = await loadMobileNetModel();
    const browserImage = await loadBrowserImage(input.uri);
    const predictions = await mobileNetModel.classify(browserImage, 8);
    const recognition = createRecognitionFromPredictions(predictions);

    if (recognition) {
      return recognition;
    }
  } catch (error) {
    if (fileNameRecognition) {
      return fileNameRecognition;
    }

    throw error;
  }

  if (fileNameRecognition) {
    return fileNameRecognition;
  }

  throw new Error(`Не удалось автоматически понять еду по ${input.sourceLabel}.`);
};
