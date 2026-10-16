import { tmdbLanguageOf } from "../utils/appLanguages";
import axios from "axios";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getCachedValue, setCachedValue, TTL } from "../utils/apiCache";

export const EMMY_CATEGORIES = [
  { key: "drama_series", labelKey: "autoI18n.emmy_cat_drama", tr: "Drama Dizisi", icon: "television-classic" },
  { key: "comedy_series", labelKey: "autoI18n.emmy_cat_comedy", tr: "Komedi Dizisi", icon: "emoticon-happy-outline" },
  { key: "limited_series", labelKey: "autoI18n.emmy_cat_limited", tr: "Mini Dizi", icon: "filmstrip" },
  { key: "animated_program", labelKey: "autoI18n.emmy_cat_animation", tr: "Animasyon", icon: "palette" },
  { key: "documentary_series", labelKey: "autoI18n.emmy_cat_documentary", tr: "Belgesel", icon: "video-vintage" },
  { key: "international_emmy", labelKey: "autoI18n.emmy_cat_international", tr: "Uluslararası Emmy", icon: "earth" },
];

export const DEFAULT_EMMY_CATEGORY = "drama_series";

export const FALLBACK_EMMY_CONFIG = {
  "updatedAt": 1786904726000,
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
        "drama_series": 126308,
        "comedy_series": 136315,
        "limited_series": 241259,
        "animated_program": 94605,
        "documentary_series": 235345,
        "international_emmy": 133490
      }
    },
    {
      "year": 2025,
      "isConfirmed": true,
      "categories": {
        "drama_series": 126308,
        "comedy_series": 124101,
        "limited_series": 241259,
        "animated_program": 225180,
        "documentary_series": 235345,
        "international_emmy": 133490
      }
    },
    {
      "year": 2024,
      "isConfirmed": true,
      "categories": {
        "drama_series": 126308,
        "comedy_series": 124101,
        "limited_series": 241259,
        "animated_program": 225180,
        "documentary_series": 235345,
        "international_emmy": 133490
      }
    },
    {
      "year": 2023,
      "isConfirmed": true,
      "categories": {
        "drama_series": 76331,
        "comedy_series": 136315,
        "limited_series": 154385,
        "animated_program": 456,
        "documentary_series": 128876,
        "international_emmy": 133490
      }
    },
    {
      "year": 2022,
      "isConfirmed": true,
      "categories": {
        "drama_series": 76331,
        "comedy_series": 97546,
        "limited_series": 111803,
        "animated_program": 94605,
        "documentary_series": 128876,
        "international_emmy": 103913
      }
    },
    {
      "year": 2021,
      "isConfirmed": true,
      "categories": {
        "drama_series": 65494,
        "comedy_series": 97546,
        "limited_series": 87739,
        "animated_program": 86831,
        "documentary_series": 79525,
        "international_emmy": 103913
      }
    },
    {
      "year": 2020,
      "isConfirmed": true,
      "categories": {
        "drama_series": 76331,
        "comedy_series": 61662,
        "limited_series": 79788,
        "animated_program": 60625,
        "documentary_series": 79525,
        "international_emmy": 87508
      }
    },
    {
      "year": 2019,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1399,
        "comedy_series": 67070,
        "limited_series": 87108,
        "animated_program": 456,
        "documentary_series": 83880,
        "international_emmy": 77994
      }
    },
    {
      "year": 2018,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1399,
        "comedy_series": 70796,
        "limited_series": 70813,
        "animated_program": 60625,
        "documentary_series": 77601,
        "international_emmy": 71446
      }
    },
    {
      "year": 2017,
      "isConfirmed": true,
      "categories": {
        "drama_series": 69478,
        "comedy_series": 2947,
        "limited_series": 68665,
        "animated_program": 32726,
        "documentary_series": 68595,
        "international_emmy": 70523
      }
    },
    {
      "year": 2016,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1399,
        "comedy_series": 2947,
        "limited_series": 65057,
        "animated_program": 10283,
        "documentary_series": 64439,
        "international_emmy": 62681
      }
    },
    {
      "year": 2015,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1399,
        "comedy_series": 2947,
        "limited_series": 62417,
        "animated_program": 456,
        "documentary_series": 61929,
        "international_emmy": 62681
      }
    },
    {
      "year": 2014,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1396,
        "comedy_series": 1421,
        "limited_series": 60622,
        "animated_program": 32726,
        "documentary_series": 58474,
        "international_emmy": 46616
      }
    },
    {
      "year": 2013,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1396,
        "comedy_series": 1421,
        "limited_series": 55431,
        "animated_program": 2190,
        "documentary_series": 15069,
        "international_emmy": 46616
      }
    },
    {
      "year": 2012,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1407,
        "comedy_series": 1421,
        "limited_series": 43348,
        "animated_program": 456,
        "documentary_series": 8724,
        "international_emmy": 37363
      }
    },
    {
      "year": 2011,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1104,
        "comedy_series": 1421,
        "limited_series": 39591,
        "animated_program": 615,
        "documentary_series": 15069,
        "international_emmy": 37680
      }
    },
    {
      "year": 2010,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1104,
        "comedy_series": 1421,
        "limited_series": 19163,
        "animated_program": 456,
        "documentary_series": 31708,
        "international_emmy": 17340
      }
    },
    {
      "year": 2009,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1104,
        "comedy_series": 4608,
        "limited_series": 13561,
        "animated_program": 2190,
        "documentary_series": 15069,
        "international_emmy": 17340
      }
    },
    {
      "year": 2008,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1104,
        "comedy_series": 4608,
        "limited_series": 15114,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 2973
      }
    },
    {
      "year": 2007,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1398,
        "comedy_series": 4608,
        "limited_series": 4586,
        "animated_program": 2190,
        "documentary_series": 1044,
        "international_emmy": 17340
      }
    },
    {
      "year": 2006,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1973,
        "comedy_series": 2316,
        "limited_series": 1253,
        "animated_program": 456,
        "documentary_series": 1044,
        "international_emmy": 2973
      }
    },
    {
      "year": 2005,
      "isConfirmed": true,
      "categories": {
        "drama_series": 4607,
        "comedy_series": 2140,
        "limited_series": 6266,
        "animated_program": 2190,
        "documentary_series": 15069,
        "international_emmy": 2973
      }
    },
    {
      "year": 2004,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1398,
        "comedy_series": 4589,
        "limited_series": 1991,
        "animated_program": 2723,
        "documentary_series": 15069,
        "international_emmy": 2973
      }
    },
    {
      "year": 2003,
      "isConfirmed": true,
      "categories": {
        "drama_series": 688,
        "comedy_series": 2140,
        "limited_series": 4426,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 2973
      }
    },
    {
      "year": 2002,
      "isConfirmed": true,
      "categories": {
        "drama_series": 688,
        "comedy_series": 1668,
        "limited_series": 4613,
        "animated_program": 615,
        "documentary_series": 13579,
        "international_emmy": 2973
      }
    },
    {
      "year": 2001,
      "isConfirmed": true,
      "categories": {
        "drama_series": 688,
        "comedy_series": 105,
        "limited_series": 2710,
        "animated_program": 456,
        "documentary_series": 13579,
        "international_emmy": 2973
      }
    },
    {
      "year": 2000,
      "isConfirmed": true,
      "categories": {
        "drama_series": 688,
        "comedy_series": 4454,
        "limited_series": 2810,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 2973
      }
    },
    {
      "year": 1999,
      "isConfirmed": true,
      "categories": {
        "drama_series": 4619,
        "comedy_series": 1480,
        "limited_series": 2910,
        "animated_program": 2122,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1998,
      "isConfirmed": true,
      "categories": {
        "drama_series": 4619,
        "comedy_series": 3452,
        "limited_series": 3010,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1997,
      "isConfirmed": true,
      "categories": {
        "drama_series": 549,
        "comedy_series": 3452,
        "limited_series": 2583,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1996,
      "isConfirmed": true,
      "categories": {
        "drama_series": 4588,
        "comedy_series": 3452,
        "limited_series": 13675,
        "animated_program": 2228,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1995,
      "isConfirmed": true,
      "categories": {
        "drama_series": 194,
        "comedy_series": 3452,
        "limited_series": 3310,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1994,
      "isConfirmed": true,
      "categories": {
        "drama_series": 206,
        "comedy_series": 3452,
        "limited_series": 2583,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1993,
      "isConfirmed": true,
      "categories": {
        "drama_series": 206,
        "comedy_series": 1400,
        "limited_series": 2583,
        "animated_program": 2098,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1992,
      "isConfirmed": true,
      "categories": {
        "drama_series": 4396,
        "comedy_series": 3219,
        "limited_series": 3610,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1991,
      "isConfirmed": true,
      "categories": {
        "drama_series": 732,
        "comedy_series": 141,
        "limited_series": 3710,
        "animated_program": 456,
        "documentary_series": 9693,
        "international_emmy": 492
      }
    },
    {
      "year": 1990,
      "isConfirmed": true,
      "categories": {
        "drama_series": 732,
        "comedy_series": 3219,
        "limited_series": 3810,
        "animated_program": 456,
        "documentary_series": 9693,
        "international_emmy": 492
      }
    },
    {
      "year": 1989,
      "isConfirmed": true,
      "categories": {
        "drama_series": 732,
        "comedy_series": 141,
        "limited_series": 32675,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1988,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1448,
        "comedy_series": 4500,
        "limited_series": 4010,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1987,
      "isConfirmed": true,
      "categories": {
        "drama_series": 732,
        "comedy_series": 1678,
        "limited_series": 4110,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1986,
      "isConfirmed": true,
      "categories": {
        "drama_series": 4223,
        "comedy_series": 1678,
        "limited_series": 20753,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1985,
      "isConfirmed": true,
      "categories": {
        "drama_series": 4223,
        "comedy_series": 1759,
        "limited_series": 3591,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1984,
      "isConfirmed": true,
      "categories": {
        "drama_series": 3828,
        "comedy_series": 141,
        "limited_series": 4410,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1983,
      "isConfirmed": true,
      "categories": {
        "drama_series": 3828,
        "comedy_series": 141,
        "limited_series": 13780,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1982,
      "isConfirmed": true,
      "categories": {
        "drama_series": 3828,
        "comedy_series": 3253,
        "limited_series": 6479,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1981,
      "isConfirmed": true,
      "categories": {
        "drama_series": 3828,
        "comedy_series": 2251,
        "limited_series": 6480,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1980,
      "isConfirmed": true,
      "categories": {
        "drama_series": 480,
        "comedy_series": 2251,
        "limited_series": 12209,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1979,
      "isConfirmed": true,
      "categories": {
        "drama_series": 480,
        "comedy_series": 2251,
        "limited_series": 13555,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1978,
      "isConfirmed": true,
      "categories": {
        "drama_series": 954,
        "comedy_series": 1922,
        "limited_series": 15571,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1977,
      "isConfirmed": true,
      "categories": {
        "drama_series": 492,
        "comedy_series": 2962,
        "limited_series": 13555,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1976,
      "isConfirmed": true,
      "categories": {
        "drama_series": 9855,
        "comedy_series": 2962,
        "limited_series": 492,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1975,
      "isConfirmed": true,
      "categories": {
        "drama_series": 492,
        "comedy_series": 2962,
        "limited_series": 156138,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1974,
      "isConfirmed": true,
      "categories": {
        "drama_series": 492,
        "comedy_series": 918,
        "limited_series": 873,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1973,
      "isConfirmed": true,
      "categories": {
        "drama_series": 5021,
        "comedy_series": 1922,
        "limited_series": 15985,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1972,
      "isConfirmed": true,
      "categories": {
        "drama_series": 1103,
        "comedy_series": 1922,
        "limited_series": 13833,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1971,
      "isConfirmed": true,
      "categories": {
        "drama_series": 7123,
        "comedy_series": 1922,
        "limited_series": 5710,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    },
    {
      "year": 1970,
      "isConfirmed": true,
      "categories": {
        "drama_series": 3602,
        "comedy_series": 582,
        "limited_series": 19077,
        "animated_program": 456,
        "documentary_series": 15069,
        "international_emmy": 492
      }
    }
  ]
};

export const isValidEmmyConfig = (config) => {
  return (
    Array.isArray(config?.items) &&
    config.items.length >= FALLBACK_EMMY_CONFIG.items.length &&
    config.items.some(
      (it) =>
        it &&
        it.categories &&
        typeof it.categories === "object" &&
        Object.keys(it.categories).length > 0,
    )
  );
};

const EMMY_CONFIG_CACHE_KEY = "app_config_emmy_awards_v2";

export async function getEmmyConfig({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = await getCachedValue(EMMY_CONFIG_CACHE_KEY, TTL.EMMY);
    if (isValidEmmyConfig(cached)) {
      return cached;
    }
  }

  try {
    const ref = doc(db, "AppConfig", "emmy");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (isValidEmmyConfig(data)) {
        const sorted = {
          updatedAt: data.updatedAt || Date.now(),
          totalYears: data.items.length,
          items: [...data.items].sort((a, b) => b.year - a.year),
        };
        setCachedValue(EMMY_CONFIG_CACHE_KEY, sorted);
        return sorted;
      }
    }
  } catch (error) {
    // Firestore erişim hatasında yerel önbelleğe düşer
  }

  setCachedValue(EMMY_CONFIG_CACHE_KEY, FALLBACK_EMMY_CONFIG);
  return FALLBACK_EMMY_CONFIG;
}

/**
 * Belirli bir kategorideki (örn: drama_series) dizileri kronolojik olarak (10'ar yıl) çeker.
 */
export async function fetchEmmyByCategory({
  configItems,
  categoryKey = "drama_series",
  page = 0,
  pageSize = 10,
  language = "tr",
  apiKey,
}) {
  const items = Array.isArray(configItems) && configItems.length > 0 ? configItems : FALLBACK_EMMY_CONFIG.items;
  const startIndex = page * pageSize;
  const targetSlice = items.slice(startIndex, startIndex + pageSize);

  if (targetSlice.length === 0) {
    return { items: [], hasMore: false, nextPage: page };
  }

  const langCode = tmdbLanguageOf(language);
  const authHeader = apiKey?.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;

  const resolved = await Promise.all(
    targetSlice.map(async (entry) => {
      const tmdbId = entry.categories?.[categoryKey] || (categoryKey === "drama_series" ? entry.tmdbId : null);
      if (!entry.isConfirmed || !tmdbId) {
        return {
          id: `emmy-pending-${entry.year}-${categoryKey}`,
          year: entry.year,
          categoryKey,
          isConfirmed: false,
          isPending: true,
          name: `${entry.year} Emmy`,
          vote_average: null,
          poster_path: null,
        };
      }

      const singleCacheKey = `tv_detail_${tmdbId}_${langCode}`;
      const cachedShow = await getCachedValue(singleCacheKey, TTL.EMMY);
      if (cachedShow?.id) {
        return {
          ...cachedShow,
          year: entry.year,
          categoryKey,
          isConfirmed: true,
        };
      }

      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/tv/${tmdbId}`,
          {
            params: { language: langCode },
            headers: { Authorization: authHeader },
          },
        );
        const showData = {
          ...response.data,
          year: entry.year,
          categoryKey,
          isConfirmed: true,
        };
        setCachedValue(singleCacheKey, response.data);
        return showData;
      } catch (err) {
        if (__DEV__) {
          console.warn(`TMDB fetch error for Emmy show ${entry.year} (${tmdbId}):`, err?.message);
        }
        return {
          id: tmdbId,
          year: entry.year,
          categoryKey,
          isConfirmed: true,
          name: `${entry.year} Emmy`,
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
 * Belirli bir yıla ait tüm kategorilerdeki (6 dal) dizileri çeker.
 */
export async function fetchEmmyByYear({
  configItems,
  year,
  language = "tr",
  apiKey,
}) {
  const items = Array.isArray(configItems) && configItems.length > 0 ? configItems : FALLBACK_EMMY_CONFIG.items;
  const yearEntry = items.find((i) => i.year === Number(year)) || items[0];

  if (!yearEntry) {
    return [];
  }

  const langCode = tmdbLanguageOf(language);
  const authHeader = apiKey?.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;

  const results = await Promise.all(
    EMMY_CATEGORIES.map(async (cat) => {
      const tmdbId = yearEntry.categories?.[cat.key] || (cat.key === "drama_series" ? yearEntry.tmdbId : null);
      if (!yearEntry.isConfirmed || !tmdbId) {
        return {
          id: `emmy-pending-${yearEntry.year}-${cat.key}`,
          year: yearEntry.year,
          categoryKey: cat.key,
          categoryLabelTr: cat.tr,
          categoryLabelKey: cat.labelKey,
          isConfirmed: false,
          isPending: true,
          name: `${yearEntry.year} Emmy`,
          vote_average: null,
          poster_path: null,
        };
      }

      const singleCacheKey = `tv_detail_${tmdbId}_${langCode}`;
      const cachedShow = await getCachedValue(singleCacheKey, TTL.EMMY);
      if (cachedShow?.id) {
        return {
          ...cachedShow,
          year: yearEntry.year,
          categoryKey: cat.key,
          categoryLabelTr: cat.tr,
          categoryLabelKey: cat.labelKey,
          isConfirmed: true,
        };
      }

      try {
        const response = await axios.get(
          `https://api.themoviedb.org/3/tv/${tmdbId}`,
          {
            params: { language: langCode },
            headers: { Authorization: authHeader },
          },
        );
        const showData = {
          ...response.data,
          year: yearEntry.year,
          categoryKey: cat.key,
          categoryLabelTr: cat.tr,
          categoryLabelKey: cat.labelKey,
          isConfirmed: true,
        };
        setCachedValue(singleCacheKey, response.data);
        return showData;
      } catch (err) {
        return {
          id: tmdbId,
          year: yearEntry.year,
          categoryKey: cat.key,
          categoryLabelTr: cat.tr,
          categoryLabelKey: cat.labelKey,
          isConfirmed: true,
          name: `${yearEntry.year} Emmy`,
          poster_path: null,
        };
      }
    }),
  );

  return results;
}
