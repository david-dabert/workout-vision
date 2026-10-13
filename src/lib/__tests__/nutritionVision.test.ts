import { describe, it, expect } from 'vitest';
import {
  analyzePlatePixels,
  lookupBarcodeProduct,
  OFFLINE_STAPLE_BARCODES,
} from '../nutritionVision';

describe('Nutrition Vision Plate Analysis & Barcode Scanner', () => {
  it('segments plate pixels and estimates macronutrient breakdown', () => {
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);

    // Fill plate area with a mix of:
    // - Chicken/meat (warm brown: r=150, g=115, b=60)
    // - Broccoli/greens (deep green: r=40, g=140, b=40)
    // - Rice/carbs (beige: r=190, g=180, b=150)
    const centerX = width / 2;
    const centerY = height / 2;
    const radiusSq = 35 * 35;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distSq = dx * dx + dy * dy;
        const idx = (y * width + x) * 4;

        if (distSq < radiusSq) {
          if (x < centerX && y < centerY) {
            // Chicken (Protein)
            data[idx] = 160;
            data[idx + 1] = 120;
            data[idx + 2] = 50;
            data[idx + 3] = 255;
          } else if (x >= centerX && y < centerY) {
            // Greens (Vegetables)
            data[idx] = 30;
            data[idx + 1] = 150;
            data[idx + 2] = 30;
            data[idx + 3] = 255;
          } else {
            // Rice (Carbs)
            data[idx] = 190;
            data[idx + 1] = 180;
            data[idx + 2] = 150;
            data[idx + 3] = 255;
          }
        } else {
          // Plate ceramic edge / background
          data[idx] = 250;
          data[idx + 1] = 250;
          data[idx + 2] = 250;
          data[idx + 3] = 255;
        }
      }
    }

    const result = analyzePlatePixels(data, width, height);

    expect(result.plateCoveragePct).toBeGreaterThan(30);
    expect(result.totalGrams).toBeGreaterThan(200);
    expect(result.totalCalories).toBeGreaterThan(200);
    expect(result.totalProteinG).toBeGreaterThan(15);
    expect(result.totalCarbsG).toBeGreaterThan(15);
    expect(result.components.length).toBe(4);

    const proteinComp = result.components.find(c => c.category === 'protein');
    const vegComp = result.components.find(c => c.category === 'vegetables');
    const carbComp = result.components.find(c => c.category === 'carbs');

    expect(proteinComp).toBeDefined();
    expect(vegComp).toBeDefined();
    expect(carbComp).toBeDefined();
    expect(proteinComp!.estimatedGrams).toBeGreaterThan(40);
    expect(vegComp!.estimatedGrams).toBeGreaterThan(20);
  });

  it('retrieves staple product instantly from offline athletic cache', async () => {
    // Optimum Nutrition Gold Standard Whey Barcode
    const result = await lookupBarcodeProduct('5060746500000');
    expect(result).not.toBeNull();
    expect(result!.brand).toBe('Optimum Nutrition');
    expect(result!.proteinG).toBe(24.0);
    expect(result!.calories).toBe(116);

    // Fleury Michon Blanc de Poulet
    const chicken = await lookupBarcodeProduct('3228857000166');
    expect(chicken).not.toBeNull();
    expect(chicken!.proteinG).toBe(22.0);
    expect(chicken!.nutriScore).toBe('A');
  });

  it('returns null for unknown empty barcode', async () => {
    const res = await lookupBarcodeProduct('');
    expect(res).toBeNull();
  });
});
