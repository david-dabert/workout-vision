import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateDynamicManifest,
  applyBrandToDocument,
  resetBrandToDefault,
  CoachBrandProfile,
  DEFAULT_BRAND,
} from '../coachBranding';

describe('White-Label Dynamic PWA Branding Engine', () => {
  let mockDoc: {
    title: string;
    documentElement: {
      style: {
        properties: Record<string, string>;
        setProperty: (k: string, v: string) => void;
        removeProperty: (k: string) => void;
        getPropertyValue: (k: string) => string;
      };
      removeAttribute: (attr: string) => void;
    };
    querySelector: (sel: string) => { setAttribute: (k: string, v: string) => void; remove: () => void } | null;
    createElement: (tag: string) => { setAttribute: (k: string, v: string) => void };
    head: { appendChild: (el: unknown) => void };
  };

  beforeEach(() => {
    const props: Record<string, string> = {};
    mockDoc = {
      title: 'WorkoutVision',
      documentElement: {
        style: {
          properties: props,
          setProperty(k, v) { props[k] = v; },
          removeProperty(k) { delete props[k]; },
          getPropertyValue(k) { return props[k] || ''; },
        },
        removeAttribute() {},
      },
      querySelector: () => null,
      createElement: () => ({ setAttribute: () => {} }),
      head: { appendChild: () => {} },
    };
  });

  it('generates a valid W3C Web App Manifest incorporating custom coach identity', () => {
    const customBrand: CoachBrandProfile = {
      brandName: 'Apex Human Performance',
      shortName: 'Apex Gym',
      tagline: 'Elite Strength & Conditioning',
      accentColor: '#2563EB',
      logoDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      isCustomBranded: true,
    };

    const manifest = generateDynamicManifest(customBrand);
    expect(manifest.name).toBe('Apex Human Performance');
    expect(manifest.short_name).toBe('Apex Gym');
    expect(manifest.description).toBe('Elite Strength & Conditioning');
    expect(manifest.theme_color).toBe('#2563EB');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect((manifest.icons as Array<{ src: string }>)[0].src).toContain('data:image/png;base64');
  });

  it('falls back to default WorkoutVision metadata when custom branding is disabled', () => {
    const unbranded: CoachBrandProfile = {
      brandName: '',
      isCustomBranded: false,
    };

    const manifest = generateDynamicManifest(unbranded);
    expect(manifest.name).toBe('WorkoutVision');
    expect(manifest.theme_color).toBe(DEFAULT_BRAND.accentColor);
  });

  it('applies brand CSS variables and document title directly to the DOM', () => {
    const customBrand: CoachBrandProfile = {
      brandName: 'Veloce Coaching',
      accentColor: '#10B981',
      accentHover: '#059669',
      isCustomBranded: true,
    };

    applyBrandToDocument(customBrand, mockDoc as unknown as Document);

    expect(mockDoc.title).toBe('Veloce Coaching · WorkoutVision');
    expect(mockDoc.documentElement.style.getPropertyValue('--accent')).toBe('#10B981');
    expect(mockDoc.documentElement.style.getPropertyValue('--accent-hover')).toBe('#059669');
  });

  it('resets brand styling and title back to standard defaults cleanly', () => {
    const customBrand: CoachBrandProfile = {
      brandName: 'Iron Works',
      accentColor: '#DC2626',
      isCustomBranded: true,
    };

    applyBrandToDocument(customBrand, mockDoc as unknown as Document);
    expect(mockDoc.documentElement.style.getPropertyValue('--accent')).toBe('#DC2626');

    resetBrandToDefault(mockDoc as unknown as Document);
    expect(mockDoc.title).toBe('WorkoutVision');
    expect(mockDoc.documentElement.style.getPropertyValue('--accent')).toBe('');
  });
});
