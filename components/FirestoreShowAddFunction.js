import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase"; // Firestore bağlantısını içe aktar

// 📌 İzlenen bölümü Firestore'a ekleyen fonksiyon
export const markEpisodeAsWatched = async ({
  user,
  showId,
  showName,
  seasonNumber,
  episodeNumber,
  showEpisodeCount,
  showSeasonCount,
  episodeName,
  episodeRatings,
  episodeMinutes,
  seasonEpisodes,
  showPosterPath,
  seasonPosterPath,
  episodePosterPath,
}) => {
  if (!user) return;

  try {
    const userRef = doc(db, "Lists", user.uid);
    const docSnap = await getDoc(userRef);

    let data = docSnap.exists() ? docSnap.data() : { watchedTv: [] };
    let watchedTv = data.watchedTv || [];

    let tvShowIndex = watchedTv.findIndex((show) => show.id === showId);

    const pad = (num) => num.toString().padStart(2, "0");
    const now = new Date();
    const episodeDate = `${pad(now.getDate())}/${pad(
      now.getMonth() + 1
    )}/${now.getFullYear()}`;

    if (tvShowIndex === -1) {
      watchedTv.push({
        id: showId,
        name: showName,
        showEpisodeCount,
        showSeasonCount,
        imagePath: showPosterPath,
        type: "tv",
        seasons: [
          {
            seasonNumber,
            seasonPosterPath: seasonPosterPath || null,
            seasonEpisodes,
            episodes: [
              {
                episodeNumber,
                episodePosterPath: episodePosterPath || null,
                episodeName: episodeName || "Unknown",
                episodeRatings: episodeRatings || 0,
                episodeMinutes: episodeMinutes || 0,
                episodeWatchTime: episodeDate || 0,
              },
            ],
          },
        ],
      });
    } else {
      let seasons = watchedTv[tvShowIndex].seasons || [];
      let seasonIndex = seasons.findIndex(
        (s) => s.seasonNumber === seasonNumber
      );

      if (seasonIndex === -1) {
        seasons.push({
          seasonNumber,
          seasonPosterPath: seasonPosterPath || null,
          seasonEpisodes,
          episodes: [
            {
              episodeNumber,
              episodePosterPath: episodePosterPath || null,
              episodeName: episodeName || "Unknown",
              episodeRatings: episodeRatings || 0,
              episodeMinutes: episodeMinutes || 0,
              episodeWatchTime: episodeDate || 0,
            },
          ],
        });
      } else {
        let episodes = seasons[seasonIndex].episodes || [];
        let episodeIndex = episodes.findIndex(
          (ep) => ep.episodeNumber === episodeNumber
        );

        if (episodeIndex === -1) {
          episodes.push({
            episodeNumber,
            episodePosterPath: episodePosterPath || null,
            episodeName: episodeName || "Unknown",
            episodeRatings: episodeRatings || 0,
            episodeMinutes: episodeMinutes || 0,
            episodeWatchTime: episodeDate || 0,
          });
        } else {
          episodes.splice(episodeIndex, 1);

          if (episodes.length === 0) {
            seasons.splice(seasonIndex, 1);
          }
        }
      }

      watchedTv[tvShowIndex].seasons = seasons
        .map((season) => ({
          ...season,
          episodes: season.episodes.sort(
            (a, b) => a.episodeNumber - b.episodeNumber
          ),
        }))
        .sort((a, b) => a.seasonNumber - b.seasonNumber);

      watchedTv[tvShowIndex].seasonCount =
        watchedTv[tvShowIndex].seasons.length;
      watchedTv[tvShowIndex].episodeCount = watchedTv[
        tvShowIndex
      ].seasons.reduce(
        (acc, s) => acc + (s.episodes ? s.episodes.length : 0),
        0
      );

      if (watchedTv[tvShowIndex].episodeCount === 0) {
        watchedTv.splice(tvShowIndex, 1);
      }
    }

    await updateDoc(userRef, { watchedTv });
  } catch (error) {
    console.error("Hata:", error);
  }
};
