import { useListStatusContext } from "@context/ListStatusContext";

const EMPTY = Object.freeze({
  inWatchList: false,
  inFavorites: false,
  isWatched: false,
  isInOtherLists: false,
});

export const useListStatus = (mediaId, mediaType) => {
  const { statusIndex, loading } = useListStatusContext();
  const bucket = mediaType === "tv" ? statusIndex.tv : statusIndex.movie;
  const status = mediaId != null ? (bucket[mediaId] ?? EMPTY) : EMPTY;
  return { ...status, loading };
};
