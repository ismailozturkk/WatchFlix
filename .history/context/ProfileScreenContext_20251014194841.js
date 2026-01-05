import React, { createContext, useContext, useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  updateDoc,
  deleteField,
  getDoc,
  setDoc,
  arrayUnion,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import { useTheme } from "./ThemeContext";
import { Animated } from "react-native";
const avatars = [
  require("../assets/avatar/man_0.jpg"),
  require("../assets/avatar/man_1.jpg"),
  require("../assets/avatar/man_2.jpg"),
  require("../assets/avatar/man_3.jpg"),
  require("../assets/avatar/man_4.jpg"),
  require("../assets/avatar/man_5.jpg"),
  require("../assets/avatar/man_6.jpg"),
  require("../assets/avatar/man_7.jpg"),
  require("../assets/avatar/woman_0.jpg"),
  require("../assets/avatar/woman_1.jpg"),
  require("../assets/avatar/woman_2.jpg"),
  require("../assets/avatar/woman_3.jpg"),
  require("../assets/avatar/woman_4.jpg"),
  require("../assets/avatar/woman_5.jpg"),
  require("../assets/avatar/woman_6.jpg"),
  require("../assets/avatar/woman_7.jpg"),
  require("../assets/avatar/woman_8.jpg"),
  require("../assets/avatar/woman_9.jpg"),
  require("../assets/avatar/woman_10.jpg"),
  require("../assets/avatar/woman_11.jpg"),
  require("../assets/avatar/woman_12.jpg"),
];
const ProfileScreenContext = createContext();
export const useProfileScreen = () => useContext(ProfileScreenContext);

export const ProfileScreenProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid;
  const { t, language } = useLanguage();
  const { theme } = useTheme();

  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDeleteVisible, setModalDeleteVisible] = useState(false);

  const [watchedMovieCount, setWatchedMovieCount] = useState(0);
  const [totalWatchedTime, setTotalWatchedTime] = useState({});

  const [watchedTvCount, setWatchedTvCount] = useState(0);
  const [totalSeasonsCount, setTotalSeasonsCount] = useState(0);
  const [totalEpisodesCount, setTotalEpisodesCount] = useState(0);
  const [totalWatchedTimeTv, setTotalWatchedTimeTv] = useState({});

  const [totalMinutesTime, setTotalMinutesTime] = useState(0);
  const [totalMinutesTimeTv, setTotalMinutesTimeTv] = useState(0);
  const [avatar, setAvatar] = useState(avatars[0]);
  const [selectAvatarIndex, setSelectAvatarIndex] = useState(0);
  //console.log("Avatar:", avatar);
  const [isloadingAvatar, setIsLoadingAvatar] = useState(false);
  const [isloadingShowInfo, setIsLoadingShowInfo] = useState(false);
  const [isloadingMovieInfo, setIsLoadingMovieInfo] = useState(false);

  //!-------------------------------   AsyncStorage'den liste görünümünü yükle
  const [gridStyle, setGridStyle] = useState(true);

  const saveListGridStyle = async (isGrid) => {
    try {
      await AsyncStorage.setItem("listGridStyle", isGrid ? "true" : "false");
      setGridStyle(isGrid);
      console.log("yazıldı");
    } catch (error) {
      console.log("❌ Kayıt hatası:", error);
    }
  };
  useEffect(() => {
    const getListGridStyle = async () => {
      try {
        const value = await AsyncStorage.getItem("listGridStyle");
        setGridStyle(value === "true");
        console.log("okundu");
      } catch (error) {
        console.log("❌ Okuma hatası:", error);
      }
    };
    getListGridStyle();
  }, [uid]);

  //!-------------------------------   AsyncStorage'den avatar yükle

  useEffect(() => {
    if (!uid) return;
    const loadAvatar = async () => {
      try {
        setIsLoadingAvatar(true);
        const storedAvatar = await AsyncStorage.getItem(`avatar_${uid}`);
        if (storedAvatar !== null) {
          const index = parseInt(storedAvatar);
          setAvatar(avatars[index]);
          setIsLoadingAvatar(false);
          setSelectAvatarIndex(index);
        }
      } catch (error) {
        console.error("Avatar yüklenemedi:", error);
      } finally {
        setIsLoadingAvatar(false);
      }
    };

    loadAvatar();
  }, [uid]);

  //!-------------------------------  Avatar değişimini kaydet

  useEffect(() => {
    if (!uid) return;
    setIsLoadingAvatar(true);

    const saveAvatar = async () => {
      try {
        await AsyncStorage.setItem(
          `avatar_${uid}`,
          selectAvatarIndex.toString()
        );
        setAvatar(avatars[selectAvatarIndex]);
        setIsLoadingAvatar(false);
        setModalVisible(false);
      } catch (error) {
        console.error("Avatar kaydedilemedi:", error);
      } finally {
        setIsLoadingAvatar(false);
      }
    };

    saveAvatar();
  }, [selectAvatarIndex]);

  //!-------------------------------  🎬 İzlenen filmleri dinle
  useEffect(() => {
    if (!uid) return;
    setIsLoadingMovieInfo(true);
    const unsub = onSnapshot(doc(db, "Lists", uid), (docSnap) => {
      const data = docSnap.data();
      const movies =
        data?.watchedMovies?.filter((m) => m.type === "movie") || [];

      setWatchedMovieCount(movies.length);
      const totalMinutes = movies.reduce((acc, m) => acc + (m.minutes || 0), 0);
      setTotalMinutesTime(totalMinutes);
      setTotalWatchedTime(formatTime(totalMinutes));
      setIsLoadingMovieInfo(false);
    });

    return () => unsub();
  }, [uid]);

  //!-------------------------------  📺 İzlenen dizileri dinle

  useEffect(() => {
    if (!uid) return;
    setIsLoadingShowInfo(true);
    const unsub = onSnapshot(doc(db, "Lists", uid), (docSnap) => {
      const data = docSnap.data();
      const shows = data?.watchedTv || [];

      setWatchedTvCount(shows.length);
      setTotalSeasonsCount(
        shows.reduce((totalSeasonCount, show) => {
          return totalSeasonCount + (show.seasons?.length || 0);
        }, 0)
      );
      setTotalEpisodesCount(
        shows.reduce((total, show) => {
          return (
            total +
            (show.seasons?.reduce((seasonTotal, season) => {
              return seasonTotal + (season.episodes?.length || 0);
            }, 0) || 0)
          );
        }, 0)
      );

      const totalMinutes = shows.reduce((acc, show) => {
        return (
          acc +
          (show.seasons?.reduce((sAcc, season) => {
            return (
              sAcc +
              (season.episodes?.reduce(
                (eAcc, e) => eAcc + (e.episodeMinutes || 0),
                0
              ) || 0)
            );
          }, 0) || 0)
        );
      }, 0);
      setTotalMinutesTimeTv(totalMinutes);
      setTotalWatchedTimeTv(formatTime(totalMinutes));
      setIsLoadingShowInfo(false);
    });

    return () => unsub();
  }, [uid]);
  //!-------------------------------   📄 Liste verisini dinle
  useEffect(() => {
    if (!uid) return;

    const unsub = onSnapshot(doc(db, "Lists", uid), (docSnap) => {
      setLists(Object.entries(docSnap.data() || {}));
    });

    return () => unsub();
  }, [uid]);
  //!-------------------------------  🗑️ Liste silme
  const deleteList = async () => {
    if (!selectedList || !uid) return;
    try {
      await updateDoc(doc(db, "Lists", uid), {
        [selectedList]: deleteField(),
      });
      setModalDeleteVisible(false);
      Toast.show({
        type: "success",
        text1: "Liste başarıyla silindi",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Silme hatası: " + error.message,
      });
    }
  };
  //!-------------------------------  Avatar ve Rank sistemi
  const getDynamicRankColor = (totalMinutes, type = "tv") => {
    const step = Math.floor(totalMinutes / 10080); // her 10080 dk (7 gün) = 1 seviye
    const hue = (step * 35) % 360; // her seviye 35° dönsün (renk çeşitliliği yüksek olur)

    // 3 farklı renk tonu (gradient + shadow için)
    const c1 = `hsl(${hue}, 80%, 50%)`; // ana renk (border)
    const c2 = `hsl(${(hue + 20) % 360}, 90%, 60%)`; // ikinci renk (border2)
    const c3 = `hsla(${(hue + 40) % 360}, 70%, 40%, 0.9)`; // gölge efekti

    // Rank adı otomatik üretelim (isteğe bağlı)
    const rankLevel = step;
    const rankName = `Rank ${rankLevel + 1}`;

    // Tip bazlı key döndür
    return type === "movie"
      ? {
          borderColorMovie: c1,
          borderColor2Movie: c2,
          shadowColorMovie: c3,
          rankLevel,
          rankName,
        }
      : {
          borderColorTv: c1,
          borderColor2Tv: c2,
          shadowColorTv: c3,
          rankLevel,
          rankName,
        };
  };

  // Örnek Kullanım:

  const {
    borderColorTv,
    borderColor2Tv,
    shadowColorTv,
    rankName: rankNameTv,
    rankLevel: rankLevelTv,
  } = getDynamicRankColor(totalMinutesTimeTv, "tv");

  const {
    borderColorMovie,
    borderColor2Movie,
    shadowColorMovie,
    rankName: rankNameMovie,
    rankLevel: rankLevelMovie,
  } = getDynamicRankColor(totalMinutesTime, "movie");

  //!-------------------------------  ⏳ İzleme süresi formatlama
  const formatTime = (minutes) => {
    const years = Math.floor(minutes / (365 * 24 * 60));
    const months = Math.floor((minutes % (365 * 24 * 60)) / (30 * 24 * 60));
    const days = Math.floor((minutes % (30 * 24 * 60)) / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;

    return { years, months, days, hours, minutes: mins };
  };

  // Component başlangıcında, diğer state tanımlamalarının yanına:
  const [timeDisplayMode, setTimeDisplayMode] = useState("minutes"); // 'minutes', 'hours', 'days'
  // Diğer fonksiyonların yanına:
  const formatTotalDurationTime = (totalMinutes, mode) => {
    const minutes = totalMinutes;
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    switch (mode) {
      case "hours":
        return `${hours.toLocaleString("tr-TR")} ${t.profileScreen.hours}`;
      case "days":
        return `${days.toLocaleString("tr-TR")} ${t.profileScreen.days}`;
      default: // 'minutes'
        return `${minutes.toLocaleString("tr-TR")} ${t.profileScreen.minutes}`;
    }
  };
  const handleTimeClick = () => {
    setTimeDisplayMode((prevMode) => {
      switch (prevMode) {
        case "minutes":
          return "hours";
        case "hours":
          return "days";
        default:
          return "minutes";
      }
    });
  };
  //!-------------------------------  Notes

  const [modalVisibleNotesAdd, setModalVisibleNotesAdd] = useState(false);
  const [modalVisibleNotes, setModalVisibleNotes] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const [borderColorNotes, setBorderColorNotes] = useState(theme.border);
  const [backgroundColorNotes, setBackgroundColorNotes] = useState(
    theme.secondary
  );
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [noteContent, setNoteContent] = useState("");
  const [message, setMessage] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };
  // Notları getirme fonksiyonu
  // Notları getirme fonksiyonunu güncelle
  const fetchNotes = async () => {
    try {
      if (!uid) return;
      setLoadingNotes(true);
      const docRef = doc(db, "Notes", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setNotes(data.notes || []);
      } else {
        // Kullanıcının dokümanı yoksa boş array ile oluştur
        await setDoc(docRef, { notes: [] });
        setNotes([]);
      }
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Not ekleme fonksiyonunu güncelle
  const handleAddNote = async () => {
    try {
      if (message.length == 0) {
        Toast.show({
          type: "warning",
          text1: `boş not oluşturulamaz`,
        });
        return;
      }
      setLoadingNotes(true);
      const newNote = {
        id: Date.now().toString(), // Benzersiz id
        content: message,
        color: borderColorNotes,
        backgroundColor: backgroundColorNotes,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const docRef = doc(db, "Notes", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // Mevcut notlara yeni notu ekle
        await updateDoc(docRef, {
          notes: arrayUnion(newNote),
        });
      } else {
        // İlk not için dokümanı oluştur
        await setDoc(docRef, {
          notes: [newNote],
        });
      }

      setMessage("");
      setModalVisibleNotesAdd(false);
      fetchNotes();
    } catch (error) {
      console.error("Error adding note:", error);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Not güncelleme fonksiyonunu güncelle
  const handleUpdateNote = async (noteId) => {
    try {
      setLoadingNotes(true);
      const docRef = doc(db, "Notes", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const currentNotes = docSnap.data().notes;
        const updatedNotes = currentNotes.map((note) =>
          note.id === noteId
            ? {
                ...note,
                content: noteContent,
                color: borderColorNotes,
                backgroundColor: backgroundColorNotes,
                updatedAt: Date.now(),
              }
            : note
        );

        await updateDoc(docRef, { notes: updatedNotes });
      }

      setModalVisibleNotes(false);
      setIsEditable(false);
      fetchNotes();
    } catch (error) {
      console.error("Error updating note:", error);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Not silme fonksiyonunu güncelle
  const handleDeleteNote = async (noteId) => {
    try {
      setLoadingNotes(true);
      const docRef = doc(db, "Notes", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const currentNotes = docSnap.data().notes;
        const updatedNotes = currentNotes.filter((note) => note.id !== noteId);

        await updateDoc(docRef, { notes: updatedNotes });
      }

      setModalVisibleNotes(false);
      fetchNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
    } finally {
      setLoadingNotes(false);
    }
  };
  // Component mount olduğunda notları getir
  useEffect(() => {
    fetchNotes();
  }, [uid]); // Add auth dependency

  //!-------------------------------  MovieStatisticsScreen

  const [isLoading, setIsLoading] = useState(false);
  const [listItems, setListItems] = useState([]);

  const parseDate = (date) => {
    // "yyyy-mm-dd" formatı için
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Date(date);
    }
    // Firestore Timestamp ise
    if (typeof date === "object" && date.seconds) {
      return new Date(date.seconds * 1000);
    }
    return new Date(date);
  };

  useEffect(() => {
    if (!uid) return;
    setIsLoading(true);
    const docRef = doc(db, "Lists", uid);

    // Firestore'dan veriyi dinamik olarak çek
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setListItems(data["watchedMovies"] || []);
      } else {
        setListItems([]);
      }
    });
    setIsLoading(false);
    return () => unsubscribe();
  }, [uid]);

  const groupByDate = (items) => {
    const groups = {};
    items.forEach((item) => {
      let dateStr = "";
      if (typeof item.dateAdded === "string") {
        dateStr = item.dateAdded;
      } else if (typeof item.dateAdded === "object" && item.dateAdded.seconds) {
        const d = new Date(item.dateAdded.seconds * 1000);
        dateStr = d.toISOString().slice(0, 10);
      }
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(item);
    });
    return Object.entries(groups)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .map(([date, items]) => ({ title: date, data: items }));
  };

  const sortedListItems = [...listItems].sort(
    (a, b) => parseDate(b.dateAdded) - parseDate(a.dateAdded)
  );

  const groupedData = groupByDate(sortedListItems);

  // 1. Tüm türleri topla ve say
  const genreCount = {};
  (listItems || []).forEach((film) => {
    if (!film || !film.genres) return;
    (film.genres || []).forEach((genre) => {
      if (!genre) return;
      genreCount[genre] = (genreCount[genre] || 0) + 1;
    });
  });

  // 2. Türleri en çoktan aza sırala
  const sortedGenres = Object.entries(genreCount || {}).sort(
    (a, b) => b[1] - a[1]
  );
  // 3. En çok izlenen tür(ler)
  const mostWatchedGenre = sortedGenres[0]?.[0] || null;

  const secondWatchedGenre = sortedGenres[1]?.[0] || "-";
  const threeWatchedGenre = sortedGenres[2]?.[0] || "-";

  // Animated import'unun eklendiğinden emin olun
  const [scaleValues, setScaleValues] = useState({});

  useEffect(() => {
    const newScaleValues = {};
    if (listItems && listItems.length > 0) {
      listItems.forEach((item) => {
        newScaleValues[item.id] = new Animated.Value(1);
      });
      setScaleValues(newScaleValues);
    }
  }, [listItems]);

  const onPressIn = (itemId) => {
    if (!scaleValues[itemId]) return;
    Animated.timing(scaleValues[itemId], {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (itemId) => {
    if (!scaleValues[itemId]) return;
    Animated.timing(scaleValues[itemId], {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const [selectedDate, setSelectedDate] = useState(null);

  // 1. Tüm benzersiz tarihleri çıkar
  const uniqueDates = [
    ...new Set(
      sortedListItems.map((item) => {
        if (typeof item.dateAdded === "string") return item.dateAdded;
        if (typeof item.dateAdded === "object" && item.dateAdded.seconds) {
          return new Date(item.dateAdded.seconds * 1000)
            .toISOString()
            .slice(0, 10);
        }
        return "";
      })
    ),
  ].filter(Boolean);
  //!-------------------------------  TvShowStatisticsScreen
  const [listItemsTv, setListItemsTv] = useState([]);
  const [loadingTv, setLoadingTv] = useState(true);
  const [selectedDateTv, setSelectedDateTv] = useState(null);

  useEffect(() => {
    if (!uid) return;
    setLoadingTv(true);
    const docRef = doc(db, "Lists", uid);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setListItemsTv(data["watchedTv"] || []);
      } else {
        setListItemsTv([]);
      }
      setLoadingTv(false);
    });

    return () => unsubscribe();
  }, [uid]);

  // 1️⃣ Tüm bölümleri düzleştir
  const flatEpisodesTv = (listItemsTv || []).flatMap((tv) =>
    (tv.seasons || []).flatMap((season) =>
      (season.episodes || []).map((ep) => ({
        showId: tv.id,
        showName: tv.name,
        showImage: tv.imagePath,
        genres: tv.genres,
        seasonNumber: season.seasonNumber,
        seasonPosterPath: season.seasonPosterPath,
        episodeNumber: ep.episodeNumber,
        episodeName: ep.episodeName,
        episodeWatchTime: ep.episodeWatchTime,
        episodeMinutes: ep.episodeMinutes,
        episodeRatings: ep.episodeRatings,
        id: `${tv.id}_${season.seasonNumber}_${ep.episodeNumber}`,
        addedShowDate: tv.addedShowDate,
        addedSeasonDate: season.addedSeasonDate,
      }))
    )
  );

  // 2️⃣ Sıralama (son izlenme zamanına göre)
  const sortedFlatEpisodesTv = [...flatEpisodesTv].sort((a, b) => {
    // a için tarih
    let dateA = 0;
    if (a.episodeWatchTime?.seconds) {
      dateA = new Date(a.episodeWatchTime.seconds * 1000);
    } else if (typeof a.episodeWatchTime === "string") {
      dateA = new Date(a.episodeWatchTime);
    }

    // b için tarih
    let dateB = 0;
    if (b.episodeWatchTime?.seconds) {
      dateB = new Date(b.episodeWatchTime.seconds * 1000);
    } else if (typeof b.episodeWatchTime === "string") {
      dateB = new Date(b.episodeWatchTime);
    }

    return dateB - dateA;
  });

  // 3️⃣ Gruplama (gün bazlı)
  const groupByDateFlatTv = (items) => {
    const groups = {};
    items.forEach((item) => {
      let dateStr = null;
      if (item.episodeWatchTime?.seconds) {
        dateStr = new Date(item.episodeWatchTime.seconds * 1000)
          .toISOString()
          .slice(0, 10);
      } else if (typeof item.episodeWatchTime === "string") {
        // "2020-10-23" gibi ise
        dateStr = item.episodeWatchTime.slice(0, 10);
      }
      if (!dateStr) return;
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(item);
    });
    return Object.entries(groups)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .map(([date, items]) => ({ title: date, data: items }));
  };

  const groupedDataTv = groupByDateFlatTv(sortedFlatEpisodesTv);
  // 4️⃣ Benzersiz tarihler (filtre için)
  const uniqueDatesTv = [
    ...new Set(
      sortedFlatEpisodesTv
        .map((item) => {
          if (item.episodeWatchTime?.seconds) {
            return new Date(item.episodeWatchTime.seconds * 1000)
              .toISOString()
              .slice(0, 10);
          }
          if (typeof item.episodeWatchTime === "string") {
            // "2020-10-23" gibi ise
            return item.episodeWatchTime.slice(0, 10);
          }
          return null;
        })
        .filter(Boolean)
    ),
  ].sort((a, b) => new Date(b) - new Date(a));

  // 5️⃣ En çok izlenen türler
  const genreCountTv = {};
  (flatEpisodesTv || []).forEach((ep) => {
    if (!ep?.genres) return;
    ep.genres.forEach((genre) => {
      if (!genre) return;
      genreCountTv[genre] = (genreCountTv[genre] || 0) + 1;
    });
  });
  const sortedGenresTv = Object.entries(genreCountTv).sort(
    (a, b) => b[1] - a[1]
  );
  const mostWatchedGenreTv = sortedGenresTv[0]?.[0] || "-";
  const secondWatchedGenreTv = sortedGenresTv[1]?.[0] || "-";
  const thirdWatchedGenreTv = sortedGenresTv[2]?.[0] || "-";

  //!-------------------------------  Hatırlatıcı
  const [reminders, setReminders] = useState({
    tvReminders: [],
    movieReminders: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("movie"); // tv or movie

  useEffect(() => {
    fetchReminders();
  }, [activeTab, user, uid, reminders]);

  const fetchReminders = async () => {
    try {
      if (!uid) return;
      const reminderDoc = await getDoc(doc(db, "Reminders", uid));
      if (reminderDoc.exists()) {
        setReminders(reminderDoc.data());
      } else {
        setReminders({
          tvReminders: [],
          movieReminders: [],
        });
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching reminders:", error.message);
      setLoading(false);
    }
  };

  const calculateDateDifference = (airDate) => {
    if (isNaN(new Date(airDate))) return null;

    const airDateTime = new Date(airDate).getTime();
    const currentTime = Date.now();
    const difference = airDateTime - currentTime;

    // If air date is in the past
    if (difference < 0) {
      return {
        text: formatDate(airDate),
        isRemaining: false,
      };
    }

    // If air date is in the future
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;

    let text;
    if (months > 0) {
      text =
        remainingDays > 0
          ? `${months} ${months === 1 ? t.month : t.month} ${remainingDays} ${remainingDays === 1 ? t.days : t.days}`
          : `${months} ${months === 1 ? t.month : t.month}`;
    } else if (days > 0) {
      text = `${days} ${days === 1 ? t.days : t.days}`;
    } else {
      text = t.today;
    }

    return {
      text,
      days,
      months,
      isRemaining: true,
    };
  };
  //!-------------------------------
  return (
    <ProfileScreenContext.Provider
      value={{
        // Durumlar
        lists,
        avatar,
        avatars,
        selectedList,
        setSelectedList,
        modalVisible,
        setModalVisible,
        watchedMovieCount,
        totalWatchedTime,
        watchedTvCount,
        totalSeasonsCount,
        totalEpisodesCount,
        totalWatchedTimeTv,
        totalMinutesTime,
        totalMinutesTimeTv,
        borderColorMovie,
        shadowColorMovie,
        modalDeleteVisible,
        isloadingAvatar,
        isloadingShowInfo,
        isloadingMovieInfo,
        noteContent,
        timeDisplayMode,
        modalVisibleNotesAdd,
        modalVisibleNotes,
        // Fonksiyonlar
        isEditable,
        borderColorNotes,
        backgroundColorNotes,
        notes,
        loadingNotes,
        selectedNote,
        backgroundColorNotes,
        borderColorNotes,
        message,
        groupedData,
        uniqueDates,
        t,
        language,
        listItems,
        isLoading,
        selectedDate,
        mostWatchedGenre,
        secondWatchedGenre,
        threeWatchedGenre,
        scaleValues,
        mostWatchedGenreTv,
        secondWatchedGenreTv,
        thirdWatchedGenreTv,
        selectedDateTv,
        uniqueDatesTv,
        groupedDataTv,
        loadingTv,
        selectedDateTv,
        flatEpisodesTv,
        totalSeasonsCount,
        loading,
        activeTab,
        reminders,
        borderColor2Movie,

        borderColorTv,
        shadowColorTv,
        borderColor2Tv,
        borderColorMovie,
        shadowColorMovie,
        borderColor2Movie,

        rankNameTv,
        rankLevelTv,
        rankNameMovie,
        rankLevelMovie,
        gridStyle,
        setGridStyle,
        saveListGridStyle,
        setActiveTab,
        setSelectedDateTv,
        setSelectedDateTv,
        groupByDateFlatTv,
        setSelectedDate,
        setListItems,
        onPressIn,
        onPressOut,
        calculateDateDifference,
        setMessage,
        setBorderColorNotes,
        setBackgroundColorNotes,
        setSelectedNote,
        setBorderColorNotes,
        setIsEditable,
        setModalDeleteVisible,
        deleteList,
        setSelectAvatarIndex,
        formatTotalDurationTime,
        handleTimeClick,
        setModalVisibleNotesAdd,
        setModalVisibleNotes,
        formatDate,
        fetchNotes,
        handleAddNote,
        handleUpdateNote,
        handleDeleteNote,
        setNoteContent,
      }}
    >
      {children}
    </ProfileScreenContext.Provider>
  );
};
