import { describe, it, expect } from 'vitest';
import {
  WHOLE_FOODS_CATALOG,
  searchWholeFoods,
  calculatePortionMacros,
  calculateMealMacros,
} from '../nutritionWholeFoods';

describe('nutritionWholeFoods', () => {
  it('has a verified whole foods catalog with valid positive macros', () => {
    expect(WHOLE_FOODS_CATALOG.length).toBeGreaterThanOrEqual(20);

    for (const food of WHOLE_FOODS_CATALOG) {
      expect(food.id).toBeTruthy();
      expect(food.name).toBeTruthy();
      expect(food.nameFr).toBeTruthy();
      expect(food.per100g.kcal).toBeGreaterThanOrEqual(0);
      expect(food.per100g.protein).toBeGreaterThanOrEqual(0);
      expect(food.per100g.carbs).toBeGreaterThanOrEqual(0);
      expect(food.per100g.fat).toBeGreaterThanOrEqual(0);
      expect(food.per100g.fiber).toBeGreaterThanOrEqual(0);
    }
  });

  it('searches whole foods by English name, French name, and category', () => {
    const chickenSearch = searchWholeFoods('poulet');
    expect(chickenSearch.length).toBeGreaterThan(0);
    expect(chickenSearch[0].id).toContain('chicken');

    const proteinFilter = searchWholeFoods('', { category: 'protein' });
    expect(proteinFilter.every(f => f.category === 'protein')).toBe(true);

    const oats = searchWholeFoods('oats');
    expect(oats.some(f => f.id === 'rolled_oats')).toBe(true);
  });

  it('calculates portion macros accurately for specific gram weights', () => {
    // 200g of cooked chicken breast (31g protein / 100g -> 62g protein)
    const portion = calculatePortionMacros('chicken_breast_cooked', 200);
    expect(portion).not.toBeNull();
    expect(portion?.grams).toBe(200);
    expect(portion?.protein).toBe(62.0);
    expect(portion?.kcal).toBe(330);
    expect(portion?.fat).toBe(7.2);
    expect(portion?.carbs).toBe(0);
  });

  it('handles invalid portion inputs gracefully', () => {
    expect(calculatePortionMacros('non_existent_food', 100)).toBeNull();
    expect(calculatePortionMacros('chicken_breast_cooked', -50)).toBeNull();
    expect(calculatePortionMacros('chicken_breast_cooked', 0)).toBeNull();
  });

  it('aggregates full meal macros from multiple weighed items', () => {
    const meal = calculateMealMacros([
      { foodId: 'chicken_breast_cooked', grams: 200 }, // 62g protein, 7.2g fat, 0g carb, 330 kcal
      { foodId: 'white_rice_cooked', grams: 250 },      // 6.75g protein, 0.75g fat, 70.5g carb, 325 kcal
      { foodId: 'olive_oil', grams: 14 },               // 0g protein, 14g fat, 0g carb, 123.8 kcal
      { foodId: 'broccoli', grams: 150 },               // 3.6g protein, 0.6g fat, 10.8g carb, 52.5 kcal
    ]);

    expect(meal.items).toHaveLength(4);
    expect(meal.totalGrams).toBe(614);
    expect(meal.totalProtein).toBeCloseTo(72.4, 0);
    expect(meal.totalCarbs).toBeCloseTo(81.3, 0);
    expect(meal.totalFat).toBeCloseTo(22.6, 0);
    expect(meal.totalKcal).toBeGreaterThanOrEqual(800);
  });
});
