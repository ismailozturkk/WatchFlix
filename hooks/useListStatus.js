import { useListStatusContext } from "@context/ListStatusContext";
import { EMPTY_LIST_STATUS } from "../utils/listStatusIndex";

export const useListStatus = (mediaId, mediaType) => {
  const { statusIndex, loading = false } = useListStatusContext() || {};
  const bucket = mediaType === "tv" ? statusIndex?.tv : statusIndex?.movie;
  const status = mediaId != null ? bucket?.[mediaId] : null;
  return { ...EMPTY_LIST_STATUS, ...status, loading };
};
