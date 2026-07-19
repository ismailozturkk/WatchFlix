import { useMediaActivityContext } from "@context/MediaActivityContext";

const EMPTY = Object.freeze({
  hasRating: false,
  hasComment: false,
});

// useListStatus'un kardeşi: içerik için "puan verdim mi / yorum yaptım mı".
export const useMediaActivity = (mediaId, mediaType) => {
  const ctx = useMediaActivityContext();
  const index = ctx?.activityIndex;
  if (!index || mediaId == null) return EMPTY;
  const bucket = mediaType === "tv" ? index.tv : index.movie;
  return bucket[mediaId] ?? EMPTY;
};
