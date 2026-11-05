/**
 * White-Label & Custom Branding Engine (Dynamic PWA Web Manifest)
 *
 * Implements sovereign client-side branding for personal trainers and coaches:
 * Rather than paying $29–$79/month for SaaS vendors (like Ekklo) to compile custom
 * native app store binaries, this module allows coaches to customize their brand identity
 * (name, logo, accent colors) directly inside the browser.
 *
 * It dynamically overrides CSS design tokens, injects a localized Web App Manifest Blob,
 * and sets native splash/theme colors so that when an athlete taps "Add to Home Screen",
 * the PWA launches looking and feeling like the coach's bespoke native application.
 */

export interface CoachBrandProfile {
  brandName: string;
  shortName?: string;
  tagline?: string;
  accentColor?: string; // e.g. '#2563EB' or '#E11D48'
  accentHover?: string;
  logoDataUrl?: string; // Base64 data URL
  isCustomBranded: boolean;
}

export const DEFAULT_BRAND: CoachBrandProfile = {
  brandName: 'WorkoutVision',
  shortName: 'WorkoutVision',
  tagline: 'Precision Biomechanics & Velocity Tracking',
  accentColor: '#D97706', // Default amber-gold
  accentHover: '#F59E0B',
  isCustomBranded: false,
};

const STORAGE_KEY = 'wv_coach_brand_profile';

/**
 * Generates a valid W3C Web App Manifest object incorporating the coach's custom brand.
 */
export function generateDynamicManifest(
  brand: CoachBrandProfile,
  baseScope = '/workout-vision/'
): Record<string, unknown> {
  const name = brand.isCustomBranded && brand.brandName.trim() ? brand.brandName.trim() : DEFAULT_BRAND.brandName;
  const shortName = brand.isCustomBranded && brand.shortName?.trim() ? brand.shortName.trim() : name;
  const themeColor = brand.accentColor || DEFAULT_BRAND.accentColor;

  const manifest: Record<string, unknown> = {
    name,
    short_name: shortName,
    description: brand.tagline || DEFAULT_BRAND.tagline,
    categories: ['fitness', 'health'],
    start_url: baseScope,
    scope: baseScope,
    display: 'standalone',
    background_color: '#080706',
    theme_color: themeColor,
    icons: [
      {
        src: brand.logoDataUrl || `${baseScope}favicon.svg`,
        sizes: brand.logoDataUrl ? '512x512' : 'any',
        type: brand.logoDataUrl ? 'image/png' : 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  };

  return manifest;
}

/**
 * Creates a Blob URL for a dynamic Web App Manifest.
 */
export function createManifestBlobUrl(manifestObj: Record<string, unknown>): string {
  if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return '';
  }
  const json = JSON.stringify(manifestObj, null, 2);
  const blob = new Blob([json], { type: 'application/manifest+json' });
  return URL.createObjectURL(blob);
}

/**
 * Applies the coach's custom brand to the active DOM:
 * 1. Overrides CSS variables (--accent, --accent-hover, --accent-glow)
 * 2. Updates document.title
 * 3. Updates meta[name="theme-color"]
 * 4. Injects dynamic manifest link
 */
export function applyBrandToDocument(
  brand: CoachBrandProfile,
  doc: Document | null = typeof document !== 'undefined' ? document : null
): void {
  if (!doc) return;

  const root = doc.documentElement;
  if (!root) return;

  if (brand.isCustomBranded && brand.brandName.trim()) {
    doc.title = `${brand.brandName.trim()} · WorkoutVision`;
  } else {
    doc.title = DEFAULT_BRAND.brandName;
  }

  // Inject or clear CSS variables
  if (brand.isCustomBranded && brand.accentColor) {
    root.style.setProperty('--accent', brand.accentColor);
    const hoverColor = brand.accentHover || brand.accentColor;
    root.style.setProperty('--accent-hover', hoverColor);
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-hover');
  }

  // Update theme-color meta tag
  const metaTheme = doc.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', brand.accentColor || '#080706');
  }

  // Inject dynamic manifest if supported
  if (brand.isCustomBranded) {
    try {
      const manifestObj = generateDynamicManifest(brand);
      const blobUrl = createManifestBlobUrl(manifestObj);
      if (blobUrl) {
        let manifestLink = doc.querySelector('link[rel="manifest"]');
        if (!manifestLink) {
          manifestLink = doc.createElement('link');
          manifestLink.setAttribute('rel', 'manifest');
          doc.head?.appendChild(manifestLink);
        }
        manifestLink.setAttribute('href', blobUrl);
      }
    } catch {
      // Fallback silently if Blob/URL APIs are unavailable in testing environment
    }
  }
}

/**
 * Resets document styling and title back to default.
 */
export function resetBrandToDefault(
  doc: Document | null = typeof document !== 'undefined' ? document : null
): void {
  applyBrandToDocument(DEFAULT_BRAND, doc);
}

/**
 * Loads the stored coach brand profile from localStorage.
 */
export function getSavedBrandProfile(): CoachBrandProfile {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_BRAND };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BRAND };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_BRAND, ...parsed };
  } catch {
    return { ...DEFAULT_BRAND };
  }
}

/**
 * Persists the coach brand profile to localStorage and applies it immediately.
 */
export function saveBrandProfile(brand: CoachBrandProfile): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(brand));
    } catch {
      // Quota exceeded or private browsing restriction
    }
  }
  applyBrandToDocument(brand);
}
