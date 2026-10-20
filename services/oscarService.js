import { tmdbLanguageOf } from "../utils/appLanguages";
import axios from "axios";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getCachedValue, setCachedValue, TTL } from "../utils/apiCache";

export const OSCAR_CATEGORIES = [
  { key: "best_picture", labelKey: "autoI18n.oscar_cat_best_picture", tr: "En İyi Film", icon: "trophy-award" },
  { key: "best_international_feature", labelKey: "autoI18n.oscar_cat_international", tr: "Uluslararası", icon: "earth" },
  { key: "best_animated_feature", labelKey: "autoI18n.oscar_cat_animation", tr: "Animasyon", icon: "palette" },
  { key: "best_visual_effects", labelKey: "autoI18n.oscar_cat_visual_effects", tr: "Görsel Efekt", icon: "creation" },
  { key: "best_documentary_feature", labelKey: "autoI18n.oscar_cat_documentary", tr: "Belgesel", icon: "video-vintage" },
  { key: "best_cinematography", labelKey: "autoI18n.oscar_cat_cinematography", tr: "Görüntü Yönetimi", icon: "camera" },
];

export const DEFAULT_OSCAR_CATEGORY = "best_picture";

export const FALLBACK_OSCAR_CONFIG = {
  "updatedAt": 1786903814241,
  "totalYears": 58,
  "items": [
    {
      "year": 2027,
      "isConfirmed": false,
      "categories": {}
    },
    {
      "year": 2026,
      "isConfirmed": true,
      "categories": {
        "best_picture": 1054867,
        "best_international_feature": 1124566,
        "best_animated_feature": 803796,
        "best_visual_effects": 83533,
        "best_documentary_feature": 1393151,
        "best_cinematography": 1233413
      }
    },
    {
      "year": 2025,
      "isConfirmed": true,
      "categories": {
        "best_picture": 1064213,
        "best_international_feature": 1000837,
        "best_animated_feature": 823219,
        "best_visual_effects": 693134,
        "best_documentary_feature": 1232493,
        "best_cinematography": 693134
      }
    },
    {
      "year": 2024,
      "isConfirmed": true,
      "categories": {
        "best_picture": 872585,
        "best_international_feature": 467244,
        "best_animated_feature": 508883,
        "best_visual_effects": 940721,
        "best_documentary_feature": 1058616,
        "best_cinematography": 872585
      }
    },
    {
      "year": 2023,
      "isConfirmed": true,
      "categories": {
        "best_picture": 545611,
        "best_international_feature": 49046,
        "best_animated_feature": 555604,
        "best_visual_effects": 76600,
        "best_documentary_feature": 926676,
        "best_cinematography": 49046
      }
    },
    {
      "year": 2022,
      "isConfirmed": true,
      "categories": {
        "best_picture": 776503,
        "best_international_feature": 758866,
        "best_animated_feature": 568124,
        "best_visual_effects": 438631,
        "best_documentary_feature": 776527,
        "best_cinematography": 438631
      }
    },
    {
      "year": 2021,
      "isConfirmed": true,
      "categories": {
        "best_picture": 581734,
        "best_international_feature": 580175,
        "best_animated_feature": 508442,
        "best_visual_effects": 577922,
        "best_documentary_feature": 682110,
        "best_cinematography": 614560
      }
    },
    {
      "year": 2020,
      "isConfirmed": true,
      "categories": {
        "best_picture": 496243,
        "best_international_feature": 496243,
        "best_animated_feature": 301528,
        "best_visual_effects": 530915,
        "best_documentary_feature": 565716,
        "best_cinematography": 530915
      }
    },
    {
      "year": 2019,
      "isConfirmed": true,
      "categories": {
        "best_picture": 490132,
        "best_international_feature": 48650,
        "best_animated_feature": 324857,
        "best_visual_effects": 369972,
        "best_documentary_feature": 515042,
        "best_cinematography": 48650
      }
    },
    {
      "year": 2018,
      "isConfirmed": true,
      "categories": {
        "best_picture": 399055,
        "best_international_feature": 429191,
        "best_animated_feature": 354912,
        "best_visual_effects": 335984,
        "best_documentary_feature": 432976,
        "best_cinematography": 335984
      }
    },
    {
      "year": 2017,
      "isConfirmed": true,
      "categories": {
        "best_picture": 376867,
        "best_international_feature": 375315,
        "best_animated_feature": 1084242,
        "best_visual_effects": 278927,
        "best_documentary_feature": 377462,
        "best_cinematography": 313369
      }
    },
    {
      "year": 2016,
      "isConfirmed": true,
      "categories": {
        "best_picture": 314365,
        "best_international_feature": 336050,
        "best_animated_feature": 150540,
        "best_visual_effects": 264660,
        "best_documentary_feature": 388895,
        "best_cinematography": 281957
      }
    },
    {
      "year": 2015,
      "isConfirmed": true,
      "categories": {
        "best_picture": 898,
        "best_international_feature": 1016661,
        "best_animated_feature": 177572,
        "best_visual_effects": 157336,
        "best_documentary_feature": 293310,
        "best_cinematography": 898
      }
    },
    {
      "year": 2014,
      "isConfirmed": true,
      "categories": {
        "best_picture": 76203,
        "best_international_feature": 179144,
        "best_animated_feature": 109445,
        "best_visual_effects": 49047,
        "best_documentary_feature": 159014,
        "best_cinematography": 49047
      }
    },
    {
      "year": 2013,
      "isConfirmed": true,
      "categories": {
        "best_picture": 68734,
        "best_international_feature": 186745,
        "best_animated_feature": 62177,
        "best_visual_effects": 87827,
        "best_documentary_feature": 84334,
        "best_cinematography": 87827
      }
    },
    {
      "year": 2012,
      "isConfirmed": true,
      "categories": {
        "best_picture": 74643,
        "best_international_feature": 60243,
        "best_animated_feature": 44896,
        "best_visual_effects": 44826,
        "best_documentary_feature": 18972,
        "best_cinematography": 44826
      }
    },
    {
      "year": 2011,
      "isConfirmed": true,
      "categories": {
        "best_picture": 45269,
        "best_international_feature": 44716,
        "best_animated_feature": 10193,
        "best_visual_effects": 27205,
        "best_documentary_feature": 44639,
        "best_cinematography": 27205
      }
    },
    {
      "year": 2010,
      "isConfirmed": true,
      "categories": {
        "best_picture": 12162,
        "best_international_feature": 25376,
        "best_animated_feature": 14160,
        "best_visual_effects": 19995,
        "best_documentary_feature": 113555,
        "best_cinematography": 19995
      }
    },
    {
      "year": 2009,
      "isConfirmed": true,
      "categories": {
        "best_picture": 12405,
        "best_international_feature": 16804,
        "best_animated_feature": 1398911,
        "best_visual_effects": 4922,
        "best_documentary_feature": 14048,
        "best_cinematography": 12405
      }
    },
    {
      "year": 2008,
      "isConfirmed": true,
      "categories": {
        "best_picture": 6977,
        "best_international_feature": 246777,
        "best_animated_feature": 2062,
        "best_visual_effects": 2268,
        "best_documentary_feature": 13362,
        "best_cinematography": 7345
      }
    },
    {
      "year": 2007,
      "isConfirmed": true,
      "categories": {
        "best_picture": 1422,
        "best_international_feature": 582,
        "best_animated_feature": 9836,
        "best_visual_effects": 58,
        "best_documentary_feature": 1781,
        "best_cinematography": 1417
      }
    },
    {
      "year": 2006,
      "isConfirmed": true,
      "categories": {
        "best_picture": 1662317,
        "best_international_feature": 868,
        "best_animated_feature": 533,
        "best_visual_effects": 254,
        "best_documentary_feature": 1667,
        "best_cinematography": 1904
      }
    },
    {
      "year": 2005,
      "isConfirmed": true,
      "categories": {
        "best_picture": 70,
        "best_international_feature": 1913,
        "best_animated_feature": 9806,
        "best_visual_effects": 102382,
        "best_documentary_feature": 1392,
        "best_cinematography": 2567
      }
    },
    {
      "year": 2004,
      "isConfirmed": true,
      "categories": {
        "best_picture": 122,
        "best_international_feature": 11042,
        "best_animated_feature": 12,
        "best_visual_effects": 122,
        "best_documentary_feature": 12698,
        "best_cinematography": 8619
      }
    },
    {
      "year": 2003,
      "isConfirmed": true,
      "categories": {
        "best_picture": 1574,
        "best_international_feature": 1591,
        "best_animated_feature": 129,
        "best_visual_effects": 121,
        "best_documentary_feature": 1430,
        "best_cinematography": 4147
      }
    },
    {
      "year": 2002,
      "isConfirmed": true,
      "categories": {
        "best_picture": 453,
        "best_international_feature": 8342,
        "best_animated_feature": 808,
        "best_visual_effects": 120,
        "best_documentary_feature": 51391,
        "best_cinematography": 120
      }
    },
    {
      "year": 2001,
      "isConfirmed": true,
      "categories": {
        "best_picture": 98,
        "best_international_feature": 146,
        "best_visual_effects": 98,
        "best_documentary_feature": 272300,
        "best_cinematography": 146
      }
    },
    {
      "year": 2000,
      "isConfirmed": true,
      "categories": {
        "best_picture": 14,
        "best_international_feature": 99,
        "best_visual_effects": 603,
        "best_documentary_feature": 34045,
        "best_cinematography": 14
      }
    },
    {
      "year": 1999,
      "isConfirmed": true,
      "categories": {
        "best_picture": 1934,
        "best_international_feature": 637,
        "best_visual_effects": 12159,
        "best_documentary_feature": 4966,
        "best_cinematography": 857
      }
    },
    {
      "year": 1998,
      "isConfirmed": true,
      "categories": {
        "best_picture": 597,
        "best_international_feature": 1260736,
        "best_visual_effects": 597,
        "best_documentary_feature": 26580,
        "best_cinematography": 597
      }
    },
    {
      "year": 1997,
      "isConfirmed": true,
      "categories": {
        "best_picture": 409,
        "best_international_feature": 784,
        "best_visual_effects": 602,
        "best_documentary_feature": 10548,
        "best_cinematography": 409
      }
    },
    {
      "year": 1996,
      "isConfirmed": true,
      "categories": {
        "best_picture": 197,
        "best_international_feature": 880,
        "best_visual_effects": 9598,
        "best_documentary_feature": 51352,
        "best_cinematography": 197
      }
    },
    {
      "year": 1995,
      "isConfirmed": true,
      "categories": {
        "best_picture": 13,
        "best_international_feature": 50797,
        "best_visual_effects": 13,
        "best_documentary_feature": 85778,
        "best_cinematography": 4476
      }
    },
    {
      "year": 1994,
      "isConfirmed": true,
      "categories": {
        "best_picture": 424,
        "best_international_feature": 2470,
        "best_visual_effects": 329,
        "best_documentary_feature": 114526,
        "best_cinematography": 424
      }
    },
    {
      "year": 1993,
      "isConfirmed": true,
      "categories": {
        "best_picture": 33,
        "best_international_feature": 2731,
        "best_visual_effects": 9374,
        "best_documentary_feature": 41773,
        "best_cinematography": 293
      }
    },
    {
      "year": 1992,
      "isConfirmed": true,
      "categories": {
        "best_picture": 274,
        "best_international_feature": 38251,
        "best_visual_effects": 280,
        "best_documentary_feature": 114525,
        "best_cinematography": 820
      }
    },
    {
      "year": 1991,
      "isConfirmed": true,
      "categories": {
        "best_picture": 581,
        "best_international_feature": 1650240,
        "best_visual_effects": 861,
        "best_documentary_feature": 1365378,
        "best_cinematography": 581
      }
    },
    {
      "year": 1990,
      "isConfirmed": true,
      "categories": {
        "best_picture": 289450,
        "best_international_feature": 11216,
        "best_visual_effects": 2756,
        "best_documentary_feature": 114524,
        "best_cinematography": 9665
      }
    },
    {
      "year": 1989,
      "isConfirmed": true,
      "categories": {
        "best_picture": 380,
        "best_international_feature": 11174,
        "best_visual_effects": 856,
        "best_documentary_feature": 1717283,
        "best_cinematography": 1632
      }
    },
    {
      "year": 1988,
      "isConfirmed": true,
      "categories": {
        "best_picture": 746,
        "best_international_feature": 11832,
        "best_visual_effects": 2614,
        "best_documentary_feature": 182561,
        "best_cinematography": 746
      }
    },
    {
      "year": 1987,
      "isConfirmed": true,
      "categories": {
        "best_picture": 792,
        "best_international_feature": 295237,
        "best_visual_effects": 679,
        "best_documentary_feature": 114521,
        "best_cinematography": 575265
      }
    },
    {
      "year": 1986,
      "isConfirmed": true,
      "categories": {
        "best_picture": 606,
        "best_international_feature": 29263,
        "best_visual_effects": 1660386,
        "best_documentary_feature": 44889,
        "best_cinematography": 606
      }
    },
    {
      "year": 1985,
      "isConfirmed": true,
      "categories": {
        "best_picture": 279,
        "best_international_feature": 46088,
        "best_visual_effects": 87,
        "best_documentary_feature": 33138,
        "best_cinematography": 625
      }
    },
    {
      "year": 1984,
      "isConfirmed": true,
      "categories": {
        "best_picture": 11050,
        "best_international_feature": 5961,
        "best_visual_effects": 1892,
        "best_documentary_feature": 114520,
        "best_cinematography": 5961
      }
    },
    {
      "year": 1983,
      "isConfirmed": true,
      "categories": {
        "best_picture": 783,
        "best_international_feature": 81346,
        "best_visual_effects": 601,
        "best_documentary_feature": 114517,
        "best_cinematography": 783
      }
    },
    {
      "year": 1982,
      "isConfirmed": true,
      "categories": {
        "best_picture": 9443,
        "best_international_feature": 11911,
        "best_visual_effects": 85,
        "best_documentary_feature": 124597,
        "best_cinematography": 18254
      }
    },
    {
      "year": 1981,
      "isConfirmed": true,
      "categories": {
        "best_picture": 16619,
        "best_international_feature": 21028,
        "best_visual_effects": 1891,
        "best_documentary_feature": 113815,
        "best_cinematography": 11121
      }
    },
    {
      "year": 1980,
      "isConfirmed": true,
      "categories": {
        "best_picture": 12102,
        "best_international_feature": 659,
        "best_visual_effects": 348,
        "best_documentary_feature": 42165,
        "best_cinematography": 28
      }
    },
    {
      "year": 1979,
      "isConfirmed": true,
      "categories": {
        "best_picture": 11778,
        "best_international_feature": 4267,
        "best_visual_effects": 1061474,
        "best_documentary_feature": 92215,
        "best_cinematography": 16642
      }
    },
    {
      "year": 1978,
      "isConfirmed": true,
      "categories": {
        "best_picture": 703,
        "best_international_feature": 42223,
        "best_visual_effects": 11,
        "best_documentary_feature": 15029,
        "best_cinematography": 840
      }
    },
    {
      "year": 1977,
      "isConfirmed": true,
      "categories": {
        "best_picture": 1366,
        "best_international_feature": 1255205,
        "best_visual_effects": 254,
        "best_documentary_feature": 33324,
        "best_cinematography": 1549092
      }
    },
    {
      "year": 1976,
      "isConfirmed": true,
      "categories": {
        "best_picture": 510,
        "best_international_feature": 9764,
        "best_visual_effects": 17599,
        "best_documentary_feature": 37339,
        "best_cinematography": 3175
      }
    },
    {
      "year": 1975,
      "isConfirmed": true,
      "categories": {
        "best_picture": 240,
        "best_international_feature": 7857,
        "best_visual_effects": 11123,
        "best_documentary_feature": 42449,
        "best_cinematography": 5919
      }
    },
    {
      "year": 1974,
      "isConfirmed": true,
      "categories": {
        "best_picture": 9277,
        "best_international_feature": 1675,
        "best_visual_effects": 9552,
        "best_documentary_feature": 114513,
        "best_cinematography": 10238
      }
    },
    {
      "year": 1973,
      "isConfirmed": true,
      "categories": {
        "best_picture": 238,
        "best_international_feature": 4593,
        "best_visual_effects": 551,
        "best_documentary_feature": 38616,
        "best_cinematography": 10784
      }
    },
    {
      "year": 1972,
      "isConfirmed": true,
      "categories": {
        "best_picture": 1051,
        "best_international_feature": 4789,
        "best_visual_effects": 12335,
        "best_documentary_feature": 17875,
        "best_cinematography": 14811
      }
    },
    {
      "year": 1971,
      "isConfirmed": true,
      "categories": {
        "best_picture": 11202,
        "best_international_feature": 26451,
        "best_visual_effects": 11165,
        "best_documentary_feature": 588226,
        "best_cinematography": 38953
      }
    },
    {
      "year": 1970,
      "isConfirmed": true,
      "categories": {
        "best_picture": 3116,
        "best_international_feature": 72190,
        "best_visual_effects": 40140,
        "best_documentary_feature": 114512,
        "best_cinematography": 642
      }
    }
  ]
};

export const isValidOscarConfig = (config) => {
  return (
    Array.isArray(config?.items) &&
    config.items.length >= FALLBACK_OSCAR_CONFIG.items.length &&
    config.items.some(
      (it) =>
        it &&
        it.categories &&
        typeof it.categories === "object" &&
        Object.keys(it.categories).length > 0,
    )
  );
};

const OSCAR_CONFIG_CACHE_KEY = "app_config_oscar_awards_v6";

export async function getOscarConfig({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = await getCachedValue(OSCAR_CONFIG_CACHE_KEY, TTL.OSCAR);
    if (isValidOscarConfig(cached)) {
      return cached;
    }
  }

  try {
    const ref = doc(db, "AppConfig", "oscar");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (isValidOscarConfig(data)) {
        const sorted = {
          updatedAt: data.updatedAt || Date.now(),
          totalYears: data.items.length,
          items: [...data.items].sort((a, b) => b.year - a.year),
        };
        setCachedValue(OSCAR_CONFIG_CACHE_KEY, sorted);
        return sorted;
      }
    }
  } catch (error) {
    // Firestore erişim hatasında yerel önbelleğe düşer
  }

  setCachedValue(OSCAR_CONFIG_CACHE_KEY, FALLBACK_OSCAR_CONFIG);
  return FALLBACK_OSCAR_CONFIG;
}

/**
 * Belirli bir kategorideki (örn: best_picture) filmleri kronolojik olarak (10'ar yıl) çeker.
 */
export async function fetchOscarByCategory({
  configItems,
  categoryKey = "best_picture",
  page = 0,
  pageSize = 10,
  language = "tr",
  apiKey,
}) {
  const items = Array.isArray(configItems) && configItems.length > 0 ? configItems : FALLBACK_OSCAR_CONFIG.items;
  const startIndex = page * pageSize;
  const targetSlice = items.slice(startIndex, startIndex + pageSize);

  if (targetSlice.length === 0) {
    return { items: [], hasMore: false, nextPage: page };
  }

  const langCode = tmdbLanguageOf(language);
  const authHeader = apiKey?.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;

  const resolved = await Promise.all(
    targetSlice.map(async (entry) => {
      const tmdbId = entry.categories?.[categoryKey] || (categoryKey === "best_picture" ? entry.tmdbId : null);
      if (!entry.isConfirmed || !tmdbId) {
        return {
          id: `oscar-pending-${entry.year}-${categoryKey}`,
          year: entry.year,
          categoryKey,
          isConfirmed: false,
          isPending: true,
          title: `${entry.year} Oscar`,
          vote_average: null,
          poster_path: null,
        };
      }

      const singleCacheKey = `movie_detail_${tmdbId}_${langCode}`;
      const cachedMovie = await getCachedValue(singleCacheKey, TTL.OSCAR);
      if (cachedMovie?.id) {
        return {
          ...cachedMovie,
          year: entry.year,
          categoryKey,
          isConfirmed: true,
        };
      }

      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/movie/${tmdbId}`,
          {
            params: { language: langCode },
            headers: { Authorization: authHeader },
          },
        );
        const movieData = {
          ...response.data,
          year: entry.year,
          categoryKey,
          isConfirmed: true,
        };
        setCachedValue(singleCacheKey, response.data);
        return movieData;
      } catch (err) {
        if (__DEV__) {
          console.warn(`TMDB fetch error for Oscar movie ${entry.year} (${tmdbId}):`, err?.message);
        }
        return {
          id: tmdbId,
          year: entry.year,
          categoryKey,
          isConfirmed: true,
          title: `${entry.year} Oscar`,
          poster_path: null,
        };
      }
    }),
  );

  const hasMore = startIndex + pageSize < items.length;
  return {
    items: resolved,
    hasMore,
    nextPage: page + 1,
  };
}

/**
 * Belirli bir yıla ait tüm kategorilerdeki (6 dal) filmleri çeker.
 */
export async function fetchOscarByYear({
  configItems,
  year,
  language = "tr",
  apiKey,
}) {
  const items = Array.isArray(configItems) && configItems.length > 0 ? configItems : FALLBACK_OSCAR_CONFIG.items;
  const yearEntry = items.find((i) => i.year === Number(year)) || items[0];

  if (!yearEntry) {
    return [];
  }

  const langCode = tmdbLanguageOf(language);
  const authHeader = apiKey?.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;

  const results = await Promise.all(
    OSCAR_CATEGORIES.map(async (cat) => {
      const tmdbId = yearEntry.categories?.[cat.key] || (cat.key === "best_picture" ? yearEntry.tmdbId : null);
      if (!yearEntry.isConfirmed || !tmdbId) {
        return {
          id: `oscar-pending-${yearEntry.year}-${cat.key}`,
          year: yearEntry.year,
          categoryKey: cat.key,
          categoryLabelTr: cat.tr,
          categoryLabelKey: cat.labelKey,
          isConfirmed: false,
          isPending: true,
          title: `${yearEntry.year} Oscar`,
          vote_average: null,
          poster_path: null,
        };
      }

      const singleCacheKey = `movie_detail_${tmdbId}_${langCode}`;
      const cachedMovie = await getCachedValue(singleCacheKey, TTL.OSCAR);
      if (cachedMovie?.id) {
        return {
          ...cachedMovie,
          year: yearEntry.year,
          categoryKey: cat.key,
          categoryLabelTr: cat.tr,
          categoryLabelKey: cat.labelKey,
          isConfirmed: true,
        };
      }

      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/movie/${tmdbId}`,
          {
            params: { language: langCode },
            headers: { Authorization: authHeader },
          },
        );
        const movieData = {
          ...response.data,
          year: yearEntry.year,
          categoryKey: cat.key,
          categoryLabelTr: cat.tr,
          categoryLabelKey: cat.labelKey,
          isConfirmed: true,
        };
        setCachedValue(singleCacheKey, response.data);
        return movieData;
      } catch (err) {
        return {
          id: tmdbId,
          year: yearEntry.year,
          categoryKey: cat.key,
          categoryLabelTr: cat.tr,
          categoryLabelKey: cat.labelKey,
          isConfirmed: true,
          title: `${yearEntry.year} Oscar`,
          poster_path: null,
        };
      }
    }),
  );

  return results;
}
