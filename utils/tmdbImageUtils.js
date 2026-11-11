import { PixelRatio } from 'react-native';

/**
 * TMDB Image Sizes
 * TMDB supports specific sizes for different types of images.
 */
const TMDB_SIZES = {
  poster: [92, 154, 185, 342, 500, 780],
  backdrop: [300, 780, 1280],
  logo: [45, 92, 154, 185, 300, 500],
  profile: [45, 185, 632], // 632 is actually h632, but we treat it as width roughly 421 for logic, though TMDB uses h632
  still: [92, 185, 300],
};

/**
 * Multipliers applied to the intended screen width based on the user's selected quality level.
 * - low: Uses a smaller image than the physical screen pixels to save bandwidth (slightly blurry).
 * - medium: Uses 1x pixel ratio (standard sharpness).
 * - good: Uses actual device pixel ratio (sharp on Retina displays).
 * - high: Forces an even larger image for maximum crispness or zoom capability.
 */
const QUALITY_MULTIPLIERS = {
  low: 0.6,
  medium: 1.0,
  good: PixelRatio.get(), // Usually 2 or 3 on modern phones
  high: PixelRatio.get() * 1.5,
  original: Infinity,
};

/**
 * Calculates the optimal TMDB size string based on component width and user quality preference.
 * 
 * @param {string} type - 'poster' | 'backdrop' | 'logo' | 'profile' | 'still'
 * @param {number} expectedWidth - The width of the image component on the screen in logical pixels.
 * @param {string} qualityLevel - 'low' | 'medium' | 'good' | 'high' | 'original'
 * @returns {string} - The exact TMDB size path part (e.g., 'w185', 'w780', 'original')
 */
export const getOptimalTmdbSize = (type, expectedWidth, qualityLevel = 'good') => {
  if (qualityLevel === 'original') return 'original';
  // Bilinçli tam boy isteği (galeri yakınlaştırma / indirme): genişlik yerine "original".
  if (expectedWidth === 'original') return 'original';

  const availableSizes = TMDB_SIZES[type] || TMDB_SIZES.poster;
  const largest = availableSizes[availableSizes.length - 1];
  const largestSize = type === 'profile' && largest === 632 ? 'h632' : `w${largest}`;
  // Genişlik bilinmiyorsa en büyük CDN türevi (eskiden "original": ekranda
  // hiçbir kartın ihtiyaç duymadığı 2–6 MB'lık dosya iniyordu).
  if (!Number.isFinite(expectedWidth) || expectedWidth <= 0) return largestSize;

  const multiplier = QUALITY_MULTIPLIERS[qualityLevel] || QUALITY_MULTIPLIERS.good;
  const targetPixels = expectedWidth * multiplier;

  // Find the smallest size that is greater than or equal to targetPixels
  // If no size is large enough, fallback to the largest available specific size.
  for (let size of availableSizes) {
    if (size >= targetPixels) {
      // Special case for profile h632
      if (type === 'profile' && size === 632) {
        return 'h632';
      }
      return `w${size}`;
    }
  }

  // Hedef en büyük türevi aşıyor. Yalnız "high" (kullanıcının açık "en yüksek
  // kalite" tercihi) orijinale çıkar; normal akışta (good: DPR 3'te still 300 /
  // backdrop 1000 bile) en büyük türevde kalınır (yol haritası Y7).
  return qualityLevel === 'high' ? 'original' : largestSize;
};

/**
 * Generates the full TMDB Image URL.
 * 
 * @param {string} path - The TMDB relative path (e.g., '/xyz123.jpg')
 * @param {string} type - 'poster' | 'backdrop' | 'logo' | 'profile' | 'still'
 * @param {number} expectedWidth - The width of the component rendering it. If unknown, pass an estimate.
 * @param {string} qualityLevel - The user's preferred quality string.
 * @returns {string|null} - The full URI, or null if no path.
 */
export const buildTmdbUrl = (path, type, expectedWidth, qualityLevel) => {
  if (!path) return null;
  const sizeString = getOptimalTmdbSize(type, expectedWidth, qualityLevel);
  return `https://image.tmdb.org/t/p/${sizeString}${path}`;
};
