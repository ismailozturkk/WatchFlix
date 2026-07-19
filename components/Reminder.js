import { StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useEffect, useState } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "../context/ThemeContext";
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs,
} from "firebase/firestore";
import Toast from "react-native-toast-message";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { i18nText } from "../utils/i18nText";


export default function Reminder({
  showId,
  showName,
  seasonNumber,
  episodeNumber,
  episodeName,
  airDate,
  stillPath,
  seasonPosterPath,
  episodeMinutes,
  showPosterPath,
  type,
  episodeId,
  releaseDate,
  movieMinutes,
  movieName,
  posterPath,
  movieId,
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [isReminderSet, setIsReminderSet] = useState(false);
  const uid = user?.uid;

  const formatDateSave = (timestamp) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    const day   = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year  = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const epId = String(episodeId || `${showId}-${seasonNumber}-${episodeNumber}`);

  // ── Check ──────────────────────────────────────────────────────────────────
  const checkExistingReminder = async () => {
    try {
      if (!uid) return;

      if (type === "tv") {
        // New model: direct episode doc lookup
        const epSnap = await getDoc(
          doc(db, "Reminders", uid, "tvShows", String(showId), "episodes", epId),
        );
        if (epSnap.exists()) { setIsReminderSet(true); return; }
      } else {
        // New model: direct movie doc lookup
        const movieSnap = await getDoc(
          doc(db, "Reminders", uid, "movies", String(movieId)),
        );
        if (movieSnap.exists()) { setIsReminderSet(true); return; }
      }

      // Dual-read fallback: old Reminders/{uid} doc (pre-migration)
      const oldDoc = await getDoc(doc(db, "Reminders", uid));
      if (!oldDoc.exists()) { setIsReminderSet(false); return; }
      const data = oldDoc.data();

      if (type === "tv") {
        const show = (data.tvReminders || []).find((s) => s.showId === showId);
        if (show) {
          const season = show.seasons.find((sn) => sn.seasonNumber === seasonNumber);
          if (season) {
            const exists = season.episodes.some((ep) =>
              (episodeId && ep.episodeId === episodeId) ||
              (!episodeId && ep.episodeNumber === episodeNumber),
            );
            setIsReminderSet(exists);
            return;
          }
        }
      } else {
        const exists = (data.movieReminders || []).some((m) => m.movieId === movieId);
        setIsReminderSet(exists);
        return;
      }

      setIsReminderSet(false);
    } catch (error) {
      console.error("Error checking reminder:", error);
    }
  };

  // uid mount anında henüz çözülmemiş olabilir (auth resolve süreci) ve aynı
  // bileşen farklı bölüm/film için yeniden kullanılabilir — [] deps ile kontrol
  // tek sefer koşup zil yanlışlıkla "kurulmamış" görünüyordu.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { checkExistingReminder(); }, [uid, type, epId, movieId]);

  // ── Add / Remove ──────────────────────────────────────────────────────────
  const addReminder = async () => {
    try {
      if (!uid) return;

      if (type === "tv") {
        const episodeDocRef = doc(db, "Reminders", uid, "tvShows", String(showId), "episodes", epId);

        if (!isReminderSet) {
          // Ensure show doc exists
          const showRef = doc(db, "Reminders", uid, "tvShows", String(showId));
          const showSnap = await getDoc(showRef);
          if (!showSnap.exists()) {
            await setDoc(showRef, {
              showId:        showId        || "",
              showName:      showName      || "",
              showPosterPath: showPosterPath || "",
            });
          }

          // Add episode doc
          await setDoc(episodeDocRef, {
            episodeId:      epId,
            episodeNumber:  episodeNumber  || 0,
            episodeName:    episodeName    || "",
            airDate:        airDate        || "",
            stillPath:      stillPath      || null,
            episodeMinutes: episodeMinutes || 0,
            showId:         showId         || "",
            showName:       showName       || "",
            showPosterPath: showPosterPath  || "",
            seasonNumber:   seasonNumber   || 0,
            seasonPosterPath: seasonPosterPath || null,
            createdAt: formatDateSave(new Date()),
          });
        } else {
          // Remove episode doc
          await deleteDoc(episodeDocRef);

          // Clean up show doc if it has no episodes left
          const remainingSnap = await getDocs(
            collection(db, "Reminders", uid, "tvShows", String(showId), "episodes"),
          );
          if (remainingSnap.empty) {
            await deleteDoc(doc(db, "Reminders", uid, "tvShows", String(showId)));
          }
        }
      } else {
        const movieDocRef = doc(db, "Reminders", uid, "movies", String(movieId));

        if (!isReminderSet) {
          await setDoc(movieDocRef, {
            movieId:      movieId      || "",
            movieName:    movieName    || "",
            releaseDate:  releaseDate  || "",
            movieMinutes: movieMinutes || 0,
            posterPath:   posterPath   || null,
            type:         "movie",
            createdAt:    formatDateSave(new Date()),
          });
        } else {
          await deleteDoc(movieDocRef);
        }
      }

      setIsReminderSet(!isReminderSet);
      Toast.show({
        type:  isReminderSet ? "error" : "success",
        text1: isReminderSet ? i18nText("autoI18n.hatirlatma_kaldirildi", "Hatırlatma kaldırıldı") : i18nText("autoI18n.hatirlatma_basariyla_eklendi", "Hatırlatma başarıyla eklendi"),
      });
    } catch (error) {
      console.error("Error adding reminder:", error);
      Toast.show({ type: "error", text1: i18nText("autoI18n.hatirlatma_eklenirken_bir_hata_olustu", "Hatırlatma eklenirken bir hata oluştu") });
    }
  };

  return (
    <View>
      <TouchableOpacity onPress={addReminder}>
        <MaterialCommunityIcons
          name={isReminderSet ? "bell-ring" : "bell-ring-outline"}
          size={18}
          color={theme.colors.orange}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({});
