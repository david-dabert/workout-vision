/**
 * Nutrition engine — calorie tracking, food database, MET-based burn estimation.
 *
 * Calorie burn: Compendium of Physical Activities (Ainsworth et al. 2011).
 * MET = metabolic equivalent of task. Calories = MET * weight(kg) * hours.
 *
 * Macronutrient targets: ISSN position stand on diets and body composition
 * (Aragon et al. 2017). Protein: 1.6-2.2g/kg for hypertrophy.
 * Carbs: 3-5g/kg for moderate training. Fat: 0.5-1.5g/kg.
 */

// MET values from Compendium of Physical Activities (Ainsworth 2011)
// Strength training general: 3.5-6.0 MET depending on intensity
const EXERCISE_METS = {
  // Compound lifts (high intensity)
  squat: 6.0,
  front_squat: 6.0,
  deadlift: 6.0,
  romanian_deadlift: 5.5,
  bench_press: 5.0,
  overhead_press: 5.0,
  clean_and_press: 8.0,
  thruster: 8.0,
  man_maker: 8.0,
  turkish_get_up: 6.0,

  // Compound bodyweight
  pull_up: 5.5,
  chin_up: 5.5,
  commando_pull_up: 6.0,
  muscle_up: 7.0,
  dip: 5.0,
  push_up: 4.0,
  diamond_push_up: 4.5,
  pike_push_up: 4.5,
  inverted_row: 4.0,
  renegade_row: 6.0,
  burpee: 8.0,
  bear_crawl: 8.0,

  // Lower body compound
  lunge: 5.0,
  bulgarian_split_squat: 5.5,
  goblet_squat: 5.5,
  pistol_squat: 6.0,
  step_up: 5.0,
  leg_press: 5.0,
  hip_thrust: 5.0,
  glute_bridge: 3.5,

  // Isolation
  bicep_curl: 3.5,
  tricep_extension: 3.5,
  lateral_raise: 3.0,
  leg_extension: 3.5,
  leg_curl: 3.5,
  standing_leg_extension: 3.0,
  calf_raise: 3.0,
  crunch: 3.0,

  // Machine / cable
  lat_pulldown: 4.0,
  seated_row: 4.0,
  chest_supported_row: 4.0,
  bent_over_row: 5.0,
  machine_chest_press: 4.0,
  kettlebell_swing: 6.0,
  face_pull: 3.0,
  incline_bench_press: 5.0,
  sumo_deadlift: 6.0,
  nordic_curl: 4.0,
  seated_calf_raise: 3.0,
  hanging_leg_raise: 3.5,

  // Plyometric / cardio hybrid
  box_jump: 7.0,
  jump_squat: 7.0,
  jumping_jack: 7.0,
  mountain_climber: 8.0,
  skater_jump: 7.0,
  squat_jump_to_lunge: 7.5,

  // Isometric
  plank: 3.0,
  wall_sit: 3.0,

  // Adaptive
  superset: 5.5,
};

/**
 * Estimate calories burned for a single set.
 * Formula: kcal = MET * weight(kg) * duration(hours)
 *
 * EPOC (Excess Post-Exercise Oxygen Consumption) is NOT applied here.
 * It applies once per session, not per set. Call applySessionEPOC() on the
 * session total after summing all set calories.
 * Source: Haddock & Wilkin 2006; Bahr 1992.
 */
export function estimateCaloriesBurned(exerciseKey, bodyWeightKg, durationSeconds) {
  const met = EXERCISE_METS[exerciseKey] || 4.0;
  const hours = durationSeconds / 3600;
  return Math.round(met * bodyWeightKg * hours);
}

/**
 * Apply EPOC (Excess Post-Exercise Oxygen Consumption) to a session calorie total.
 * Call this ONCE per session after summing all set calories with estimateCaloriesBurned.
 * Applying per-set inflates the estimate by the number of sets (Haddock & Wilkin 2006).
 *
 * @param {number} totalCalories - sum of all set calories for the session
 * @returns {number} session total including 15% EPOC
 */
export function applySessionEPOC(totalCalories) {
  return Math.round(totalCalories * 1.15);
}

/**
 * Estimate total daily calorie burn from all workouts.
 */
export function estimateDailyBurn(workouts, bodyWeightKg) {
  return workouts.reduce((total, w) => {
    return total + estimateCaloriesBurned(w.exercise, bodyWeightKg, w.duration || 0);
  }, 0);
}

// Common food database — ~200 items covering major food categories
// Values per 100g unless noted. Sources: USDA FoodData Central 2024.
export const FOOD_DATABASE = [
  // Proteins
  { name: 'Chicken breast (cooked)', cal: 165, protein: 31, carbs: 0, fat: 3.6, category: 'Protein', servingG: 150, servingLabel: '1 breast' },
  { name: 'Chicken thigh (cooked)', cal: 209, protein: 26, carbs: 0, fat: 10.9, category: 'Protein', servingG: 130, servingLabel: '1 thigh' },
  { name: 'Salmon (cooked)', cal: 208, protein: 20, carbs: 0, fat: 13, category: 'Protein', servingG: 150, servingLabel: '1 fillet' },
  { name: 'Tuna (canned)', cal: 116, protein: 26, carbs: 0, fat: 0.8, category: 'Protein', servingG: 100, servingLabel: '1 can drained' },
  { name: 'Shrimp (cooked)', cal: 99, protein: 24, carbs: 0, fat: 0.3, category: 'Protein', servingG: 100, servingLabel: '10 large' },
  { name: 'Beef steak (lean)', cal: 271, protein: 26, carbs: 0, fat: 18, category: 'Protein', servingG: 200, servingLabel: '1 steak' },
  { name: 'Ground beef (90/10)', cal: 176, protein: 20, carbs: 0, fat: 10, category: 'Protein', servingG: 150, servingLabel: '1 patty' },
  { name: 'Pork chop (lean)', cal: 231, protein: 25, carbs: 0, fat: 14, category: 'Protein', servingG: 150, servingLabel: '1 chop' },
  { name: 'Turkey breast', cal: 135, protein: 30, carbs: 0, fat: 1, category: 'Protein', servingG: 150, servingLabel: '1 portion' },
  { name: 'Lamb leg (lean)', cal: 182, protein: 25, carbs: 0, fat: 8, category: 'Protein', servingG: 150, servingLabel: '1 portion' },
  { name: 'Tofu (firm)', cal: 76, protein: 8, carbs: 1.9, fat: 4.8, category: 'Protein', servingG: 150, servingLabel: '1/2 block' },
  { name: 'Tempeh', cal: 192, protein: 20, carbs: 7.6, fat: 11, category: 'Protein', servingG: 100, servingLabel: '1 portion' },
  { name: 'Egg (whole)', cal: 155, protein: 13, carbs: 1.1, fat: 11, category: 'Protein', servingG: 50, servingLabel: '1 egg' },
  { name: 'Egg whites', cal: 52, protein: 11, carbs: 0.7, fat: 0.2, category: 'Protein', servingG: 100, servingLabel: '3 whites' },
  { name: 'Whey protein powder', cal: 400, protein: 80, carbs: 8, fat: 4, category: 'Protein', servingG: 30, servingLabel: '1 scoop' },
  { name: 'Greek yogurt (plain)', cal: 59, protein: 10, carbs: 3.6, fat: 0.7, category: 'Protein', servingG: 170, servingLabel: '1 cup' },
  { name: 'Cottage cheese', cal: 98, protein: 11, carbs: 3.4, fat: 4.3, category: 'Protein', servingG: 200, servingLabel: '1 cup' },

  // Grains & carbs
  { name: 'White rice (cooked)', cal: 130, protein: 2.7, carbs: 28, fat: 0.3, category: 'Carbs', servingG: 200, servingLabel: '1 cup' },
  { name: 'Brown rice (cooked)', cal: 112, protein: 2.6, carbs: 24, fat: 0.9, category: 'Carbs', servingG: 200, servingLabel: '1 cup' },
  { name: 'Pasta (cooked)', cal: 131, protein: 5, carbs: 25, fat: 1.1, category: 'Carbs', servingG: 200, servingLabel: '1 cup' },
  { name: 'Whole wheat bread', cal: 247, protein: 13, carbs: 41, fat: 3.4, category: 'Carbs', servingG: 30, servingLabel: '1 slice' },
  { name: 'White bread', cal: 265, protein: 9, carbs: 49, fat: 3.2, category: 'Carbs', servingG: 30, servingLabel: '1 slice' },
  { name: 'Oatmeal (dry)', cal: 389, protein: 17, carbs: 66, fat: 6.9, category: 'Carbs', servingG: 40, servingLabel: '1/2 cup dry' },
  { name: 'Quinoa (cooked)', cal: 120, protein: 4.4, carbs: 21, fat: 1.9, category: 'Carbs', servingG: 185, servingLabel: '1 cup' },
  { name: 'Sweet potato (cooked)', cal: 86, protein: 1.6, carbs: 20, fat: 0.1, category: 'Carbs', servingG: 150, servingLabel: '1 medium' },
  { name: 'Potato (baked)', cal: 93, protein: 2.5, carbs: 21, fat: 0.1, category: 'Carbs', servingG: 200, servingLabel: '1 medium' },
  { name: 'Couscous (cooked)', cal: 112, protein: 3.8, carbs: 23, fat: 0.2, category: 'Carbs', servingG: 160, servingLabel: '1 cup' },
  { name: 'Tortilla (flour)', cal: 312, protein: 8, carbs: 52, fat: 8, category: 'Carbs', servingG: 45, servingLabel: '1 tortilla' },
  { name: 'Bagel', cal: 257, protein: 10, carbs: 50, fat: 1.6, category: 'Carbs', servingG: 100, servingLabel: '1 bagel' },

  // Fruits
  { name: 'Banana', cal: 89, protein: 1.1, carbs: 23, fat: 0.3, category: 'Fruit', servingG: 120, servingLabel: '1 medium' },
  { name: 'Apple', cal: 52, protein: 0.3, carbs: 14, fat: 0.2, category: 'Fruit', servingG: 180, servingLabel: '1 medium' },
  { name: 'Orange', cal: 47, protein: 0.9, carbs: 12, fat: 0.1, category: 'Fruit', servingG: 150, servingLabel: '1 medium' },
  { name: 'Blueberries', cal: 57, protein: 0.7, carbs: 14, fat: 0.3, category: 'Fruit', servingG: 150, servingLabel: '1 cup' },
  { name: 'Strawberries', cal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, category: 'Fruit', servingG: 150, servingLabel: '1 cup' },
  { name: 'Mango', cal: 60, protein: 0.8, carbs: 15, fat: 0.4, category: 'Fruit', servingG: 165, servingLabel: '1 cup diced' },
  { name: 'Grapes', cal: 69, protein: 0.7, carbs: 18, fat: 0.2, category: 'Fruit', servingG: 150, servingLabel: '1 cup' },
  { name: 'Avocado', cal: 160, protein: 2, carbs: 8.5, fat: 15, category: 'Fruit', servingG: 150, servingLabel: '1 whole' },
  { name: 'Watermelon', cal: 30, protein: 0.6, carbs: 7.6, fat: 0.2, category: 'Fruit', servingG: 280, servingLabel: '1 wedge' },
  { name: 'Pineapple', cal: 50, protein: 0.5, carbs: 13, fat: 0.1, category: 'Fruit', servingG: 165, servingLabel: '1 cup' },
  { name: 'Dates (Medjool)', cal: 277, protein: 1.8, carbs: 75, fat: 0.2, category: 'Fruit', servingG: 24, servingLabel: '1 date' },

  // Vegetables
  { name: 'Broccoli', cal: 34, protein: 2.8, carbs: 7, fat: 0.4, category: 'Vegetable', servingG: 150, servingLabel: '1 cup' },
  { name: 'Spinach (raw)', cal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, category: 'Vegetable', servingG: 30, servingLabel: '1 cup' },
  { name: 'Kale', cal: 49, protein: 4.3, carbs: 9, fat: 0.9, category: 'Vegetable', servingG: 67, servingLabel: '1 cup chopped' },
  { name: 'Carrot', cal: 41, protein: 0.9, carbs: 10, fat: 0.2, category: 'Vegetable', servingG: 75, servingLabel: '1 medium' },
  { name: 'Bell pepper', cal: 31, protein: 1, carbs: 6, fat: 0.3, category: 'Vegetable', servingG: 120, servingLabel: '1 medium' },
  { name: 'Tomato', cal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, category: 'Vegetable', servingG: 125, servingLabel: '1 medium' },
  { name: 'Cucumber', cal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, category: 'Vegetable', servingG: 300, servingLabel: '1 medium' },
  { name: 'Zucchini', cal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, category: 'Vegetable', servingG: 200, servingLabel: '1 medium' },
  { name: 'Cauliflower', cal: 25, protein: 1.9, carbs: 5, fat: 0.3, category: 'Vegetable', servingG: 150, servingLabel: '1 cup' },
  { name: 'Green beans', cal: 31, protein: 1.8, carbs: 7, fat: 0.2, category: 'Vegetable', servingG: 125, servingLabel: '1 cup' },
  { name: 'Mushrooms', cal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, category: 'Vegetable', servingG: 100, servingLabel: '1 cup sliced' },
  { name: 'Onion', cal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, category: 'Vegetable', servingG: 110, servingLabel: '1 medium' },

  // Dairy
  { name: 'Whole milk', cal: 61, protein: 3.2, carbs: 4.8, fat: 3.3, category: 'Dairy', servingG: 244, servingLabel: '1 cup' },
  { name: 'Skim milk', cal: 34, protein: 3.4, carbs: 5, fat: 0.1, category: 'Dairy', servingG: 244, servingLabel: '1 cup' },
  { name: 'Cheddar cheese', cal: 403, protein: 25, carbs: 1.3, fat: 33, category: 'Dairy', servingG: 28, servingLabel: '1 slice' },
  { name: 'Mozzarella', cal: 280, protein: 28, carbs: 3.1, fat: 17, category: 'Dairy', servingG: 28, servingLabel: '1 oz' },
  { name: 'Parmesan', cal: 431, protein: 38, carbs: 4.1, fat: 29, category: 'Dairy', servingG: 10, servingLabel: '1 tbsp' },
  { name: 'Butter', cal: 717, protein: 0.9, carbs: 0.1, fat: 81, category: 'Dairy', servingG: 14, servingLabel: '1 tbsp' },

  // Nuts & seeds
  { name: 'Almonds', cal: 579, protein: 21, carbs: 22, fat: 50, category: 'Nuts', servingG: 28, servingLabel: '1 handful (23)' },
  { name: 'Peanuts', cal: 567, protein: 26, carbs: 16, fat: 49, category: 'Nuts', servingG: 28, servingLabel: '1 handful' },
  { name: 'Walnuts', cal: 654, protein: 15, carbs: 14, fat: 65, category: 'Nuts', servingG: 28, servingLabel: '1 handful (14)' },
  { name: 'Peanut butter', cal: 588, protein: 25, carbs: 20, fat: 50, category: 'Nuts', servingG: 32, servingLabel: '2 tbsp' },
  { name: 'Almond butter', cal: 614, protein: 21, carbs: 19, fat: 56, category: 'Nuts', servingG: 32, servingLabel: '2 tbsp' },
  { name: 'Chia seeds', cal: 486, protein: 17, carbs: 42, fat: 31, category: 'Nuts', servingG: 15, servingLabel: '1 tbsp' },
  { name: 'Flax seeds', cal: 534, protein: 18, carbs: 29, fat: 42, category: 'Nuts', servingG: 10, servingLabel: '1 tbsp' },
  { name: 'Cashews', cal: 553, protein: 18, carbs: 30, fat: 44, category: 'Nuts', servingG: 28, servingLabel: '1 handful' },

  // Legumes
  { name: 'Lentils (cooked)', cal: 116, protein: 9, carbs: 20, fat: 0.4, category: 'Legumes', servingG: 200, servingLabel: '1 cup' },
  { name: 'Black beans (cooked)', cal: 132, protein: 8.9, carbs: 24, fat: 0.5, category: 'Legumes', servingG: 172, servingLabel: '1 cup' },
  { name: 'Chickpeas (cooked)', cal: 164, protein: 8.9, carbs: 27, fat: 2.6, category: 'Legumes', servingG: 164, servingLabel: '1 cup' },
  { name: 'Kidney beans (cooked)', cal: 127, protein: 8.7, carbs: 23, fat: 0.5, category: 'Legumes', servingG: 177, servingLabel: '1 cup' },
  { name: 'Hummus', cal: 166, protein: 7.9, carbs: 14, fat: 9.6, category: 'Legumes', servingG: 30, servingLabel: '2 tbsp' },

  // Fats & oils
  { name: 'Olive oil', cal: 884, protein: 0, carbs: 0, fat: 100, category: 'Fats', servingG: 14, servingLabel: '1 tbsp' },
  { name: 'Coconut oil', cal: 862, protein: 0, carbs: 0, fat: 100, category: 'Fats', servingG: 14, servingLabel: '1 tbsp' },

  // Snacks & misc
  { name: 'Dark chocolate (70%+)', cal: 598, protein: 7.8, carbs: 46, fat: 43, category: 'Snack', servingG: 30, servingLabel: '3 squares' },
  { name: 'Protein bar', cal: 350, protein: 20, carbs: 35, fat: 12, category: 'Snack', servingG: 60, servingLabel: '1 bar' },
  { name: 'Rice cakes', cal: 387, protein: 8, carbs: 81, fat: 2.8, category: 'Snack', servingG: 9, servingLabel: '1 cake' },
  { name: 'Granola', cal: 471, protein: 10, carbs: 64, fat: 20, category: 'Snack', servingG: 55, servingLabel: '1/2 cup' },
  { name: 'Trail mix', cal: 462, protein: 14, carbs: 44, fat: 29, category: 'Snack', servingG: 40, servingLabel: '1/4 cup' },
  { name: 'Honey', cal: 304, protein: 0.3, carbs: 82, fat: 0, category: 'Snack', servingG: 21, servingLabel: '1 tbsp' },

  // Drinks
  { name: 'Orange juice', cal: 45, protein: 0.7, carbs: 10, fat: 0.2, category: 'Drink', servingG: 250, servingLabel: '1 glass' },
  { name: 'Coca-Cola', cal: 42, protein: 0, carbs: 11, fat: 0, category: 'Drink', servingG: 330, servingLabel: '1 can' },
  { name: 'Coffee (black)', cal: 2, protein: 0.3, carbs: 0, fat: 0, category: 'Drink', servingG: 240, servingLabel: '1 cup' },
  { name: 'Beer (regular)', cal: 43, protein: 0.5, carbs: 3.6, fat: 0, category: 'Drink', servingG: 355, servingLabel: '1 bottle' },
  { name: 'Red wine', cal: 85, protein: 0.1, carbs: 2.6, fat: 0, category: 'Drink', servingG: 150, servingLabel: '1 glass' },
  { name: 'Smoothie (fruit)', cal: 57, protein: 0.7, carbs: 14, fat: 0.2, category: 'Drink', servingG: 300, servingLabel: '1 glass' },

  // Prepared meals (common)
  { name: 'Sushi roll (6pc)', cal: 200, protein: 8, carbs: 28, fat: 5, category: 'Meal', servingG: 180, servingLabel: '6 pieces' },
  { name: 'Caesar salad', cal: 170, protein: 7, carbs: 8, fat: 13, category: 'Meal', servingG: 250, servingLabel: '1 bowl' },
  { name: 'Cheese pizza (1 slice)', cal: 266, protein: 11, carbs: 33, fat: 10, category: 'Meal', servingG: 107, servingLabel: '1 slice' },
  { name: 'Burger (single patty)', cal: 254, protein: 14, carbs: 24, fat: 11, category: 'Meal', servingG: 150, servingLabel: '1 burger' },
  { name: 'Chicken wrap', cal: 200, protein: 15, carbs: 22, fat: 6, category: 'Meal', servingG: 200, servingLabel: '1 wrap' },
  { name: 'Pasta bolognese', cal: 160, protein: 8, carbs: 20, fat: 5, category: 'Meal', servingG: 350, servingLabel: '1 plate' },
  { name: 'Fried rice', cal: 163, protein: 4.4, carbs: 24, fat: 5.5, category: 'Meal', servingG: 250, servingLabel: '1 plate' },
  { name: 'Grilled chicken salad', cal: 130, protein: 18, carbs: 6, fat: 4, category: 'Meal', servingG: 300, servingLabel: '1 bowl' },
  { name: 'Steak frites', cal: 280, protein: 20, carbs: 25, fat: 12, category: 'Meal', servingG: 350, servingLabel: '1 plate' },
  { name: 'Fish and chips', cal: 250, protein: 15, carbs: 28, fat: 9, category: 'Meal', servingG: 300, servingLabel: '1 serving' },

  // West African / Senegalese (David's heritage)
  { name: 'Thiéboudienne (rice+fish)', cal: 175, protein: 12, carbs: 22, fat: 4.5, category: 'Meal', servingG: 400, servingLabel: '1 plate' },
  { name: 'Yassa poulet', cal: 160, protein: 18, carbs: 8, fat: 6, category: 'Meal', servingG: 350, servingLabel: '1 plate' },
  { name: 'Mafé (peanut stew)', cal: 200, protein: 14, carbs: 15, fat: 10, category: 'Meal', servingG: 350, servingLabel: '1 bowl' },
  { name: 'Attiéké (cassava couscous)', cal: 120, protein: 0.5, carbs: 30, fat: 0.2, category: 'Carbs', servingG: 200, servingLabel: '1 portion' },
  { name: 'Plantain (fried)', cal: 259, protein: 1.1, carbs: 35, fat: 14, category: 'Carbs', servingG: 120, servingLabel: '1 plantain' },
  { name: 'Fonio (cooked)', cal: 110, protein: 3.6, carbs: 22, fat: 0.7, category: 'Carbs', servingG: 180, servingLabel: '1 cup' },

  // French staples
  { name: 'Croissant', cal: 406, protein: 8, carbs: 45, fat: 21, category: 'Snack', servingG: 60, servingLabel: '1 croissant' },
  { name: 'Baguette', cal: 274, protein: 9, carbs: 56, fat: 1, category: 'Carbs', servingG: 50, servingLabel: '1/4 baguette' },
  { name: 'Crêpe (plain)', cal: 112, protein: 4, carbs: 14, fat: 4.6, category: 'Snack', servingG: 60, servingLabel: '1 crêpe' },
  { name: 'Quiche Lorraine', cal: 250, protein: 10, carbs: 18, fat: 15, category: 'Meal', servingG: 150, servingLabel: '1 slice' },
  { name: 'Croque-monsieur', cal: 293, protein: 16, carbs: 18, fat: 17, category: 'Meal', servingG: 180, servingLabel: '1 croque' },
  { name: 'Pain au chocolat', cal: 420, protein: 8, carbs: 48, fat: 22, category: 'Snack', servingG: 70, servingLabel: '1 piece' },
  { name: 'Camembert', cal: 299, protein: 20, carbs: 0.5, fat: 24, category: 'Dairy', servingG: 30, servingLabel: '1 portion' },
  { name: 'Brie', cal: 334, protein: 21, carbs: 0.5, fat: 28, category: 'Dairy', servingG: 30, servingLabel: '1 portion' },
];

/**
 * Search food database by name.
 */
export function searchFood(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return FOOD_DATABASE.filter(f =>
    f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
  ).slice(0, 20);
}

/**
 * Calculate macros for a food item at a given weight.
 */
export function calculateMacros(food, grams) {
  const ratio = grams / 100;
  return {
    calories: Math.round(food.cal * ratio),
    protein: Math.round(food.protein * ratio * 10) / 10,
    carbs: Math.round(food.carbs * ratio * 10) / 10,
    fat: Math.round(food.fat * ratio * 10) / 10,
  };
}

/**
 * Calculate daily macro targets based on profile and goal.
 * Sources: ISSN position stand (Aragon et al. 2017), Helms et al. 2014.
 *
 * Goals: 'maintain', 'cut', 'bulk'
 */
export function getDailyTargets(profile, goal) {
  if (!profile) return null;
  const weightKg = parseFloat(profile.weight) || 70;
  const heightCm = parseFloat(profile.height) || 170;
  const age = parseFloat(profile.age) || 30;
  const sex = profile.sex || 'male';
  const activity = profile.activityLevel || 'moderate';

  // Map profile.goal to nutrition goal if no explicit goal passed
  if (!goal && profile.goal) {
    const goalMap = { weight_loss: 'cut', hypertrophy: 'bulk', strength: 'bulk', endurance: 'maintain', general: 'maintain' };
    goal = goalMap[profile.goal] || 'maintain';
  }
  if (!goal) goal = 'maintain';

  // BMR (Mifflin-St Jeor)
  let bmr;
  if (sex === 'male') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }

  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    veryActive: 1.9,
  };
  const tdee = bmr * (activityMultipliers[activity] || 1.55);

  let targetCal;
  switch (goal) {
    case 'cut': targetCal = tdee - 500; break;
    case 'bulk': targetCal = tdee + 300; break;
    default: targetCal = tdee;
  }
  targetCal = Math.round(targetCal);

  // Protein scaled by goal (Aragon et al. 2017 ISSN; Helms et al. 2014)
  const proteinPerKg = goal === 'cut' ? 2.5 : goal === 'bulk' ? 1.8 : 2.0;
  const protein = Math.round(weightKg * proteinPerKg);
  // Fat: 25-30% of calories
  const fat = Math.round((targetCal * 0.27) / 9);
  // Carbs: remainder
  const carbs = Math.round((targetCal - protein * 4 - fat * 9) / 4);

  return {
    calories: targetCal,
    protein,
    carbs,
    fat,
    tdee: Math.round(tdee),
    bmr: Math.round(bmr),
  };
}

/**
 * Fetch nutrition data from OpenFoodFacts by barcode.
 * Free API, no key required.
 */
export async function fetchBarcodeNutrition(barcode) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const n = p.nutriments || {};
    return {
      name: p.product_name || p.product_name_en || p.product_name_fr || 'Unknown product',
      brand: p.brands || '',
      barcode,
      image: p.image_front_small_url || p.image_url || null,
      servingSize: p.serving_size || '100g',
      per100g: {
        cal: Math.round(n['energy-kcal_100g'] || n.energy_100g / 4.184 || 0),
        protein: Math.round((n.proteins_100g || 0) * 10) / 10,
        carbs: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
        fat: Math.round((n.fat_100g || 0) * 10) / 10,
        fiber: Math.round((n.fiber_100g || 0) * 10) / 10,
        sugar: Math.round((n.sugars_100g || 0) * 10) / 10,
      },
      nutriScore: p.nutriscore_grade || null,
    };
  } catch {
    return null;
  }
}
