import React, {
  createContext, useContext, useEffect, useState, useMemo,
} from "react";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import useUserDataDomain from "../hooks/useUserDataDomain";
import { remindersDomain } from "../services/userData";
import {
  clearReminderWidget,
  syncReminderWidget,
} from "../services/reminderWidgetService";
import { daysUntil, parseAirDate } from "../utils/airDate";

const ProfileRemindersContext = createContext();
export const useProfileReminders = () => useContext(ProfileRemindersContext);

// Takvim günü farkı üzerinden metin üretir — "geçen süre" değil (bkz.
// utils/airDate.js). Bugün yayınlanan bir bölüm gün içinde saat kaç olursa
// olsun "Bugün" der; yarınki her zaman "1 gün".
const buildDateText = (airDate, t) => {
  const days = daysUntil(airDate);
  if (days === null || days < 0) return null; // geçersiz ya da geçmiş
  if (days === 0) return t.today;
  const months = Math.floor(days / 30);
  const rem    = days % 30;
  if (months > 0) return rem > 0 ? `${months} ${t.month} ${rem} ${t.days}` : `${months} ${t.month}`;
  return `${days} ${t.days}`;
};

// Reconstruct tvReminders shape [ { showId, showName, seasons: [{ seasonNumber, episodes: [] }] } ]
const buildTvReminders = (allEpisodes) => {
  const showMap = new Map();
  allEpisodes.forEach((ep) => {
    if (!showMap.has(ep.showId)) {
      showMap.set(ep.showId, {
        showId: ep.showId,
        showName: ep.showName,
        showPosterPath: ep.showPosterPath || "",
        seasons: new Map(),
      });
    }
    const show = showMap.get(ep.showId);
    if (!show.seasons.has(ep.seasonNumber)) {
      show.seasons.set(ep.seasonNumber, {
        seasonNumber: ep.seasonNumber,
        seasonPosterPath: ep.seasonPosterPath || null,
        episodes: [],
      });
    }
    show.seasons.get(ep.seasonNumber).episodes.push(ep);
  });

  return Array.from(showMap.values()).map((show) => ({
    ...show,
    seasons: Array.from(show.seasons.values()),
  }));
};

export const ProfileRemindersProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid;
  const { t, language } = useLanguage();

  // YEREL-ÖNCELİKLİ: hatırlatıcılar buluttan dinlenmez. Eskiden burada 2 + N
  // Firestore dinleyicisi (filmler, diziler, HER DİZİ İÇİN bölümler) açılışta
  // tüm belgeleri okuyordu; Takvim aynısını ikinci kez yapıyordu. Artık okuma
  // yerel kopyadan SENKRON, yazma yerelde + kalıcı günlükte anında (buluta
  // arka planda), buluttan çekim yalnız kopya yokken TEK SEFER.
  // Bkz. services/userData ve docs/mimari/YEREL_ONCELIKLI_VERI_KATMANI.md
  const view = useUserDataDomain(remindersDomain);
  const movieReminders = view.lists.movies;
  const allTvEpisodes = view.lists.episodes;
  // Yalnız tek seferlik indirme sürerken "yükleniyor": normal açılışta hep false.
  const loading = !view.ready && view.hydrating;
  const [activeTab,      setActiveTab]      = useState("movie");

  const reminders = useMemo(() => ({
    movieReminders,
    tvReminders: buildTvReminders(allTvEpisodes),
  }), [movieReminders, allTvEpisodes]);

  // Çıkış: ana ekran widget'ı önceki hesabın hatırlatıcılarını göstermesin.
  useEffect(() => {
    if (!uid) clearReminderWidget();
  }, [uid]);

  // Android ana ekran widget'ı Firestore'a ikinci bir bağlantı açmaz. Context'in
  // canonical verisinin küçük bir özetini yerel native depoya aktarır; widget
  // buradan çizilir ve uygulama kapalıyken de son senkronize listeyi gösterebilir.
  useEffect(() => {
    if (!uid) return;
    syncReminderWidget(reminders, language);
  }, [uid, reminders, language]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    // parseAirDate: "2026-07-26" yerel gece yarısı olarak çözülür, yoksa
    // negatif UTC ofsetli cihazlarda bir önceki gün yazardı.
    const date = parseAirDate(timestamp);
    if (!date) return typeof timestamp === "string" ? timestamp : "Bilinmeyen Tarih";
    return new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric" }).format(date);
  };

  const calculateDateDifference = (airDate) => {
    const days = daysUntil(airDate);
    if (days === null) return null;
    const text = buildDateText(airDate, t);
    if (text === null) return { text: formatDate(airDate), isRemaining: false };
    return { text, days, months: Math.floor(days / 30), isRemaining: true };
  };

  const value = useMemo(() => ({
    reminders, loading, activeTab, setActiveTab,
    formatDate, calculateDateDifference,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [reminders, loading, activeTab, language]);

  return (
    <ProfileRemindersContext.Provider value={value}>
      {children}
    </ProfileRemindersContext.Provider>
  );
};
