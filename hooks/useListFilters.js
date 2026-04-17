import { useMemo, useState } from "react";

export function useListFilters(listItems) {
  const [search, setSearch] = useState("");
  const [sortType, setSortType] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [genre, setGenre] = useState(null);
  const [tvStatus, setTvStatus] = useState(null);

  const filtered = useMemo(() => {
    let data = [...listItems];

    // SEARCH
    if (search) {
      data = data.filter((i) =>
        (i.name || "").toLowerCase().includes(search.toLowerCase()),
      );
    }

    // TV STATUS
    if (tvStatus !== null) {
      data = data.filter((item) => {
        const totalEpisodes = Array.isArray(item.seasons)
          ? item.seasons.reduce((acc, s) => acc + (s.episodes?.length || 0), 0)
          : 0;

        const isFinished = totalEpisodes === item.showEpisodeCount;

        return tvStatus ? isFinished : !isFinished;
      });
    }

    // GENRE
    if (genre) {
      data = data.filter((i) => i.genres?.includes(genre));
    }

    return data;
  }, [listItems, search, tvStatus, genre]);

  return {
    filtered,
    search,
    setSearch,
    sortType,
    setSortType,
    sortOrder,
    setSortOrder,
    genre,
    setGenre,
    tvStatus,
    setTvStatus,
  };
}
