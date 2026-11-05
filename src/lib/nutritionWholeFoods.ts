/**
 * Sovereign Offline Whole-Foods Nutrition Engine.
 *
 * Solves the "Whole Foods Nutrition Void" identified in our architectural critique:
 * Athletes weigh unprocessed staples on kitchen scales (chicken breast, rice, eggs, oats, olive oil)
 * which have no barcodes for Open Food Facts scanning.
 *
 * Provides a verified offline dictionary of foundational athletic whole foods with
 * instant sub-millisecond gram-portion macro calculations without server or network calls.
 *
 * Reference: USDA FoodData Central & CIQUAL nutritional averages.
 */

export interface WholeFoodItem {
  id: string;
  name: string;
  nameFr: string;
  category: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy';
  per100g: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  defaultServingGrams?: number;
}

export interface MacronutrientPortion {
  foodId: string;
  name: string;
  nameFr: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface MealSummary {
  items: MacronutrientPortion[];
  totalGrams: number;
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
}

export const WHOLE_FOODS_CATALOG: readonly WholeFoodItem[] = Object.freeze([
  // PROTEINS
  {
    id: 'chicken_breast_raw',
    name: 'Chicken Breast (raw)',
    nameFr: 'Blanc de poulet (cru)',
    category: 'protein',
    per100g: { kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, fiber: 0 },
    defaultServingGrams: 150,
  },
  {
    id: 'chicken_breast_cooked',
    name: 'Chicken Breast (grilled/cooked)',
    nameFr: 'Blanc de poulet (cuit)',
    category: 'protein',
    per100g: { kcal: 165, protein: 31.0, carbs: 0, fat: 3.6, fiber: 0 },
    defaultServingGrams: 150,
  },
  {
    id: 'beef_5pct',
    name: 'Ground Beef 5% Fat',
    nameFr: 'Bœuf haché 5% MG',
    category: 'protein',
    per100g: { kcal: 130, protein: 21.0, carbs: 0, fat: 5.0, fiber: 0 },
    defaultServingGrams: 150,
  },
  {
    id: 'beef_15pct',
    name: 'Ground Beef 15% Fat',
    nameFr: 'Bœuf haché 15% MG',
    category: 'protein',
    per100g: { kcal: 215, protein: 19.5, carbs: 0, fat: 15.0, fiber: 0 },
    defaultServingGrams: 150,
  },
  {
    id: 'salmon_raw',
    name: 'Atlantic Salmon (raw)',
    nameFr: 'Saumon atlantique (cru)',
    category: 'protein',
    per100g: { kcal: 208, protein: 20.4, carbs: 0, fat: 13.4, fiber: 0 },
    defaultServingGrams: 150,
  },
  {
    id: 'tuna_canned_water',
    name: 'Tuna (canned in water)',
    nameFr: 'Thon au naturel (boîte)',
    category: 'protein',
    per100g: { kcal: 116, protein: 26.0, carbs: 0, fat: 1.0, fiber: 0 },
    defaultServingGrams: 130,
  },
  {
    id: 'egg_whole',
    name: 'Egg (whole, large)',
    nameFr: 'Œuf entier',
    category: 'protein',
    per100g: { kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0 },
    defaultServingGrams: 55, // ~1 egg
  },
  {
    id: 'egg_white',
    name: 'Egg White',
    nameFr: 'Blanc d’œuf',
    category: 'protein',
    per100g: { kcal: 52, protein: 10.9, carbs: 0.7, fat: 0.2, fiber: 0 },
    defaultServingGrams: 100,
  },
  {
    id: 'whey_isolate',
    name: 'Whey Protein Isolate',
    nameFr: 'Isolat de Whey',
    category: 'protein',
    per100g: { kcal: 370, protein: 88.0, carbs: 1.5, fat: 1.2, fiber: 0 },
    defaultServingGrams: 30,
  },

  // CARBS
  {
    id: 'white_rice_raw',
    name: 'White Rice (dry/raw)',
    nameFr: 'Riz blanc (cru)',
    category: 'carb',
    per100g: { kcal: 360, protein: 7.0, carbs: 79.0, fat: 0.7, fiber: 1.3 },
    defaultServingGrams: 80,
  },
  {
    id: 'white_rice_cooked',
    name: 'White Rice (cooked)',
    nameFr: 'Riz blanc (cuit)',
    category: 'carb',
    per100g: { kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4 },
    defaultServingGrams: 200,
  },
  {
    id: 'basmati_rice_cooked',
    name: 'Basmati Rice (cooked)',
    nameFr: 'Riz basmati (cuit)',
    category: 'carb',
    per100g: { kcal: 121, protein: 3.5, carbs: 25.0, fat: 0.4, fiber: 0.6 },
    defaultServingGrams: 200,
  },
  {
    id: 'rolled_oats',
    name: 'Rolled Oats (dry)',
    nameFr: 'Flocons d’avoine',
    category: 'carb',
    per100g: { kcal: 379, protein: 13.2, carbs: 67.7, fat: 6.5, fiber: 10.1 },
    defaultServingGrams: 60,
  },
  {
    id: 'sweet_potato_baked',
    name: 'Sweet Potato (baked)',
    nameFr: 'Patate douce (cuite au four)',
    category: 'carb',
    per100g: { kcal: 90, protein: 2.0, carbs: 20.7, fat: 0.2, fiber: 3.3 },
    defaultServingGrams: 200,
  },
  {
    id: 'potato_boiled',
    name: 'Potato (boiled with skin)',
    nameFr: 'Pomme de terre (cuite à l’eau)',
    category: 'carb',
    per100g: { kcal: 87, protein: 1.9, carbs: 20.1, fat: 0.1, fiber: 1.8 },
    defaultServingGrams: 200,
  },
  {
    id: 'pasta_dry',
    name: 'Durum Wheat Pasta (dry)',
    nameFr: 'Pâtes au blé dur (crues)',
    category: 'carb',
    per100g: { kcal: 355, protein: 12.5, carbs: 71.0, fat: 1.5, fiber: 3.2 },
    defaultServingGrams: 80,
  },

  // FATS & OILS
  {
    id: 'olive_oil',
    name: 'Extra Virgin Olive Oil',
    nameFr: 'Huile d’olive extra vierge',
    category: 'fat',
    per100g: { kcal: 884, protein: 0, carbs: 0, fat: 100.0, fiber: 0 },
    defaultServingGrams: 14, // 1 tablespoon
  },
  {
    id: 'avocado',
    name: 'Avocado (fresh)',
    nameFr: 'Avocat',
    category: 'fat',
    per100g: { kcal: 160, protein: 2.0, carbs: 8.5, fat: 14.7, fiber: 6.7 },
    defaultServingGrams: 75, // half avocado
  },
  {
    id: 'almonds',
    name: 'Almonds (raw)',
    nameFr: 'Amandes (brutes)',
    category: 'fat',
    per100g: { kcal: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5 },
    defaultServingGrams: 30,
  },
  {
    id: 'peanut_butter_pure',
    name: 'Peanut Butter (100% peanuts)',
    nameFr: 'Beurre de cacahuète 100%',
    category: 'fat',
    per100g: { kcal: 588, protein: 25.1, carbs: 20.0, fat: 50.4, fiber: 6.0 },
    defaultServingGrams: 30,
  },

  // DAIRY
  {
    id: 'greek_yogurt_0pct',
    name: 'Greek Yogurt 0% Fat',
    nameFr: 'Yaourt grec 0% MG',
    category: 'dairy',
    per100g: { kcal: 59, protein: 10.3, carbs: 3.6, fat: 0.4, fiber: 0 },
    defaultServingGrams: 150,
  },
  {
    id: 'cottage_cheese_lowfat',
    name: 'Cottage Cheese (low fat)',
    nameFr: 'Fromage blanc / Cottage cheese allégé',
    category: 'dairy',
    per100g: { kcal: 72, protein: 12.4, carbs: 2.7, fat: 1.0, fiber: 0 },
    defaultServingGrams: 150,
  },

  // VEGETABLES & FRUITS
  {
    id: 'broccoli',
    name: 'Broccoli (raw/steamed)',
    nameFr: 'Brocoli (cuit vapeur)',
    category: 'vegetable',
    per100g: { kcal: 35, protein: 2.4, carbs: 7.2, fat: 0.4, fiber: 3.3 },
    defaultServingGrams: 150,
  },
  {
    id: 'spinach_fresh',
    name: 'Spinach (fresh)',
    nameFr: 'Épinards frais',
    category: 'vegetable',
    per100g: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2 },
    defaultServingGrams: 100,
  },
  {
    id: 'banana',
    name: 'Banana (fresh)',
    nameFr: 'Banane',
    category: 'fruit',
    per100g: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6 },
    defaultServingGrams: 120, // 1 medium banana
  },
  {
    id: 'blueberries',
    name: 'Blueberries (fresh)',
    nameFr: 'Myrtilles fraîches',
    category: 'fruit',
    per100g: { kcal: 57, protein: 0.7, carbs: 14.5, fat: 0.3, fiber: 2.4 },
    defaultServingGrams: 100,
  },
]);

/** Map for O(1) item lookups by ID */
const FOOD_MAP = new Map<string, WholeFoodItem>(WHOLE_FOODS_CATALOG.map(f => [f.id, f]));

/**
 * Search whole foods by partial string match (English or French).
 */
export function searchWholeFoods(
  query: string,
  options?: { category?: WholeFoodItem['category']; limit?: number }
): WholeFoodItem[] {
  const q = (query || '').trim().toLowerCase();
  const limit = options?.limit ?? 20;

  return WHOLE_FOODS_CATALOG.filter(item => {
    if (options?.category && item.category !== options.category) return false;
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.nameFr.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  }).slice(0, limit);
}

/**
 * Computes exact macronutrient totals for a specified gram portion of a whole food.
 */
export function calculatePortionMacros(foodId: string, grams: number): MacronutrientPortion | null {
  const food = FOOD_MAP.get(foodId);
  if (!food || typeof grams !== 'number' || grams <= 0) return null;

  const ratio = grams / 100;
  return {
    foodId: food.id,
    name: food.name,
    nameFr: food.nameFr,
    grams: Math.round(grams * 10) / 10,
    kcal: Math.round(food.per100g.kcal * ratio * 10) / 10,
    protein: Math.round(food.per100g.protein * ratio * 10) / 10,
    carbs: Math.round(food.per100g.carbs * ratio * 10) / 10,
    fat: Math.round(food.per100g.fat * ratio * 10) / 10,
    fiber: Math.round(food.per100g.fiber * ratio * 10) / 10,
  };
}

/**
 * Aggregates a full meal or daily food log of weighed whole foods.
 */
export function calculateMealMacros(items: Array<{ foodId: string; grams: number }>): MealSummary {
  const portions: MacronutrientPortion[] = [];
  let totalGrams = 0;
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;

  for (const item of items) {
    const p = calculatePortionMacros(item.foodId, item.grams);
    if (!p) continue;
    portions.push(p);
    totalGrams += p.grams;
    totalKcal += p.kcal;
    totalProtein += p.protein;
    totalCarbs += p.carbs;
    totalFat += p.fat;
    totalFiber += p.fiber;
  }

  return {
    items: portions,
    totalGrams: Math.round(totalGrams * 10) / 10,
    totalKcal: Math.round(totalKcal),
    totalProtein: Math.round(totalProtein * 10) / 10,
    totalCarbs: Math.round(totalCarbs * 10) / 10,
    totalFat: Math.round(totalFat * 10) / 10,
    totalFiber: Math.round(totalFiber * 10) / 10,
  };
}
