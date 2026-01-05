import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React, { useEffect, useState } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "../context/ThemeContext";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import Toast from "react-native-toast-message";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

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
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };
  useEffect(() => {
    checkExistingReminder();
  }, []);

  // Bölüm için episodeId ile kontrol
  const checkExistingReminder = async () => {
    try {
      if (!user) return;

      const reminderDoc = await getDoc(doc(db, "Reminders", uid));
      if (reminderDoc.exists()) {
        const data = reminderDoc.data();
        if (type === "tv") {
          const tvReminders = data.tvReminders || [];
          const show = tvReminders.find((s) => s.showId === showId);
          let exists = false;
          if (show) {
            const season = show.seasons.find(
              (sn) => sn.seasonNumber === seasonNumber
            );
            if (season) {
              exists = season.episodes.some(
                (ep) =>
                  (episodeId && ep.episodeId === episodeId) ||
                  (!episodeId && ep.episodeNumber === episodeNumber)
              );
            }
          }
          setIsReminderSet(exists);
        } else {
          const movieReminders = data.movieReminders || [];
          const exists = movieReminders.some(
            (item) => item.movieId === movieId
          );
          setIsReminderSet(exists);
        }
      }
    } catch (error) {
      console.error("Error checking reminder:", error);
    }
  };

  const addReminder = async () => {
    try {
      if (!user) return;

      const reminderRef = doc(db, "Reminders", uid);
      const reminderDoc = await getDoc(reminderRef);

      if (type === "tv") {
        const episodeData = {
          episodeId: episodeId || `${showId}-${seasonNumber}-${episodeNumber}`,
          episodeNumber: episodeNumber || 0,
          episodeName: episodeName || "",
          airDate: airDate || "",
          stillPath: stillPath || null,
          episodeMinutes: episodeMinutes || 0,
          createdAt: formatDateSave(new Date()),
        };

        let tvReminders = [];
        if (reminderDoc.exists()) {
          tvReminders = reminderDoc.data().tvReminders || [];
        }

        // Show bul
        let showIndex = tvReminders.findIndex((show) => show.showId === showId);

        if (showIndex === -1) {
          // Dizi yok, ekle
          tvReminders.push({
            showId: showId || "",
            showName: showName || "",
            showPosterPath: showPosterPath || "",
            seasons: [
              {
                seasonNumber: seasonNumber || 0,
                seasonPosterPath: seasonPosterPath || null,
                episodes: [episodeData],
              },
            ],
          });
        } else {
          // Dizi var
          let show = tvReminders[showIndex];
          let seasonIndex = show.seasons.findIndex(
            (season) => season.seasonNumber === seasonNumber
          );

          if (seasonIndex === -1) {
            // Sezon yok, ekle
            show.seasons.push({
              seasonNumber: seasonNumber || 0,
              seasonPosterPath: seasonPosterPath || null,
              episodes: [episodeData],
            });
          } else {
            // Sezon var
            let episodes = show.seasons[seasonIndex].episodes;
            let episodeIndex = episodes.findIndex(
              (ep) =>
                (episodeId && ep.episodeId === episodeId) ||
                (!episodeId && ep.episodeNumber === episodeNumber)
            );

            if (episodeIndex === -1 && !isReminderSet) {
              // Bölüm yok, ekle
              episodes.push(episodeData);
            } else if (episodeIndex !== -1 && isReminderSet) {
              // Bölüm var, sil
              episodes.splice(episodeIndex, 1);

              // Eğer sezon boşsa sil
              if (episodes.length === 0) {
                show.seasons.splice(seasonIndex, 1);
              }
              // Eğer dizi tamamen boşsa sil
              if (show.seasons.length === 0) {
                tvReminders.splice(showIndex, 1);
              }
            }
          }
        }

        // Firestore'a kaydet/güncelle
        if (!reminderDoc.exists()) {
          await setDoc(reminderRef, {
            tvReminders,
            movieReminders: [],
            updatedAt: formatDateSave(new Date()),
          });
        } else {
          await updateDoc(reminderRef, {
            tvReminders,
            updatedAt: formatDateSave(new Date()),
          });
        }
      } else {
        // Movie için
        const movieData = {
          movieId: movieId || "",
          movieName: movieName || "",
          releaseDate: releaseDate || "",
          movieMinutes: movieMinutes || 0,
          posterPath: posterPath || null,
          type: "movie",
          createdAt: formatDateSave(new Date()),
        };

        let movieReminders = [];
        if (reminderDoc.exists()) {
          movieReminders = reminderDoc.data().movieReminders || [];
        }

        const movieIndex = movieReminders.findIndex(
          (item) => item.movieId === movieId
        );

        if (movieIndex === -1 && !isReminderSet) {
          movieReminders.push(movieData);
        } else if (movieIndex !== -1 && isReminderSet) {
          movieReminders.splice(movieIndex, 1);
        }

        if (!reminderDoc.exists()) {
          await setDoc(reminderRef, {
            tvReminders: [],
            movieReminders,
            updatedAt: formatDateSave(new Date()),
          });
        } else {
          await updateDoc(reminderRef, {
            movieReminders,
            updatedAt: formatDateSave(new Date()),
          });
        }
      }

      setIsReminderSet(!isReminderSet);
      Toast.show({
        type: isReminderSet ? "error" : "success",
        text1: isReminderSet
          ? "Hatırlatma kaldırıldı"
          : "Hatırlatma başarıyla eklendi",
      });
    } catch (error) {
      console.error("Error adding reminder:", error);
      Toast.show({
        type: "error",
        text1: "Hatırlatma eklenirken bir hata oluştu",
      });
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
