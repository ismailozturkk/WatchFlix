export function buildActivityFromRoot(activity) {
  const index = { movie: {}, tv: {} };
  const mark = (type, id, patch) => {
    index[type][id] = {
      hasRating: false,
      hasComment: false,
      rating: null,
      ...index[type][id],
      ...patch,
    };
  };
  Object.entries(activity?.ratings || {}).forEach(([key, value]) => {
    if (value == null) return;
    const match = /^(movie|tv)_(.+)$/.exec(key);
    if (match) mark(match[1], match[2], { hasRating: true, rating: Number(value) });
  });
  (Array.isArray(activity?.comments) ? activity.comments : []).forEach((key) => {
    if (key == null) return;
    const match = /^(movie|tv)_(.+)$/.exec(String(key));
    if (match) mark(match[1], match[2], { hasComment: true });
    // Older numeric keys cannot distinguish types. Retain legacy visibility
    // until the summary is rebuilt from the user's typed comment mirrors.
    else if (/^\d+$/.test(String(key))) {
      mark("movie", String(key), { hasComment: true });
      mark("tv", String(key), { hasComment: true });
    }
  });
  return index;
}
