const normalizeGenreName = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const resolveGenreIds = (genreNames, ...catalogs) => {
  const nameToId = new Map();
  catalogs.flat().forEach((genre) => {
    const id = Number(genre?.id);
    const key = normalizeGenreName(genre?.name);
    if (id && key) nameToId.set(key, id);
  });

  return [...new Set(
    (genreNames || [])
      .map((name) => nameToId.get(normalizeGenreName(name)))
      .filter(Boolean),
  )];
};

export const mergeProviderResults = (providerResponses) => {
  const byId = new Map();

  (providerResponses || []).forEach(({ providerId, results = [] }) => {
    results.forEach((item) => {
      if (!item?.id) return;
      const current = byId.get(item.id);
      const providerIds = new Set(current?._subscriptionProviderIds || []);
      providerIds.add(Number(providerId));
      byId.set(item.id, {
        ...(current || item),
        _subscriptionProviderIds: [...providerIds],
      });
    });
  });

  return [...byId.values()].sort(
    (a, b) =>
      Number(b.popularity || 0) - Number(a.popularity || 0) ||
      Number(b.vote_count || 0) - Number(a.vote_count || 0),
  );
};

