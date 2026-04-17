export function sortList(data, sortType, order) {
  const sorted = [...data];

  if (sortType === "name") {
    sorted.sort((a, b) =>
      order === "asc"
        ? (a.name || "").localeCompare(b.name || "")
        : (b.name || "").localeCompare(a.name || ""),
    );
  }

  if (sortType === "release") {
    sorted.sort((a, b) =>
      order === "asc"
        ? new Date(a.releaseDate || 0) - new Date(b.releaseDate || 0)
        : new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0),
    );
  }

  if (sortType === "added") {
    sorted.sort((a, b) =>
      order === "asc"
        ? (a.createdAt || 0) - (b.createdAt || 0)
        : (b.createdAt || 0) - (a.createdAt || 0),
    );
  }

  return sorted;
}
