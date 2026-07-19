import axios from "axios";

const memoryCache = new Map();
const inflight = new Map();
const CORPUS_TTL = 6 * 60 * 60 * 1000;

export function normalizeSearchText(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function damerauLevenshtein(leftValue, rightValue) {
  const left = normalizeSearchText(leftValue);
  const right = normalizeSearchText(rightValue);
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array(right.length + 1).fill(0),
  );
  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }
  return matrix[left.length][right.length];
}

const getNames = (item, mediaType) => {
  if (mediaType === "person") return [item.name, item.original_name];
  if (mediaType === "tv") return [item.name, item.original_name];
  return [item.title, item.original_title];
};

const candidateVariants = (candidate, query) => {
  const normalized = normalizeSearchText(candidate);
  const queryLength = query.length;
  const queryWordCount = query.split(" ").filter(Boolean).length;
  const words = normalized.split(" ").filter(Boolean);
  return [
    normalized,
    normalized.slice(0, queryLength),
    words.slice(0, queryWordCount).join(" "),
  ].filter(Boolean);
};

export function getFuzzyDistance(item, queryValue, mediaType) {
  const query = normalizeSearchText(queryValue);
  if (!query) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (const name of getNames(item, mediaType)) {
    if (!name) continue;
    for (const variant of candidateVariants(name, query)) {
      best = Math.min(best, damerauLevenshtein(query, variant));
    }
  }
  return best;
}

export function getAllowedDistance(queryValue) {
  const length = normalizeSearchText(queryValue).replace(/\s/g, "").length;
  if (length <= 4) return 1;
  if (length <= 8) return 2;
  return Math.min(3, Math.max(2, Math.floor(length * 0.22)));
}

export function rankFuzzyCandidates(items, query, mediaType, limit = 30) {
  const allowed = getAllowedDistance(query);
  return (items || [])
    .map((item) => ({ item, distance: getFuzzyDistance(item, query, mediaType) }))
    .filter(({ distance }) => distance <= allowed)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      const aWeight = Number(a.item.popularity || 0) + Number(a.item.vote_count || 0) / 100;
      const bWeight = Number(b.item.popularity || 0) + Number(b.item.vote_count || 0) / 100;
      return bWeight - aWeight;
    })
    .slice(0, limit)
    .map(({ item }) => item);
}

const dedupe = (items) => {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = item?.id == null ? null : String(item.id);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const corpusRequests = (mediaType) => {
  if (mediaType === "person") {
    return [
      ["/trending/person/week", 1],
      ["/person/popular", 1],
      ["/person/popular", 2],
      ["/person/popular", 3],
    ];
  }
  return [
    [`/trending/${mediaType}/week`, 1],
    [`/${mediaType}/popular`, 1],
    [`/${mediaType}/popular`, 2],
    [`/${mediaType}/top_rated`, 1],
  ];
};

async function loadFallbackCorpus({ mediaType, language, adultContent, API_KEY }) {
  const key = `${mediaType}_${language}_${adultContent ? "adult" : "safe"}`;
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CORPUS_TTL) return cached.items;
  if (inflight.has(key)) return inflight.get(key);

  const request = Promise.all(
    corpusRequests(mediaType).map(([path, page]) =>
      axios.get(`https://api.themoviedb.org/3${path}`, {
        params: {
          language,
          page,
          ...(mediaType !== "person" ? { include_adult: adultContent } : {}),
        },
        headers: { Authorization: API_KEY },
      }),
    ),
  )
    .then((responses) => {
      const items = dedupe(responses.flatMap((response) => response.data?.results || []));
      const filtered =
        mediaType === "person"
          ? items.filter((item) => item.known_for_department === "Acting")
          : items;
      memoryCache.set(key, { timestamp: Date.now(), items: filtered });
      return filtered;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

export async function searchMediaWithFuzzyFallback({
  mediaType,
  query,
  language,
  adultContent,
  API_KEY,
}) {
  const endpointType = mediaType === "person" ? "person" : mediaType;
  const response = await axios.get(
    `https://api.themoviedb.org/3/search/${endpointType}`,
    {
      params: {
        query: query.trim(),
        include_adult: adultContent,
        language,
        page: 1,
      },
      headers: { Authorization: API_KEY },
    },
  );

  const regular = (response.data?.results || []).filter((item) =>
    mediaType === "person" ? item.known_for_department === "Acting" : true,
  );
  const hasExactRegular = regular.some(
    (item) => getFuzzyDistance(item, query, mediaType) === 0,
  );
  if (hasExactRegular) {
    return { results: regular, usedFuzzyFallback: false };
  }

  const closeRegular = rankFuzzyCandidates(regular, query, mediaType);
  if (closeRegular.length > 0) {
    return {
      results: dedupe([...closeRegular, ...regular]),
      usedFuzzyFallback: true,
    };
  }

  try {
    const corpus = await loadFallbackCorpus({
      mediaType,
      language,
      adultContent,
      API_KEY,
    });
    const fuzzy = rankFuzzyCandidates(corpus, query, mediaType);
    return {
      results: dedupe([...fuzzy, ...regular]),
      usedFuzzyFallback: fuzzy.length > 0,
    };
  } catch {
    return { results: regular, usedFuzzyFallback: false };
  }
}
