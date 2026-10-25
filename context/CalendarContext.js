import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  useImageQualitySettings,
} from "./AppSettingsContext";
import useUserDataDomain from "../hooks/useUserDataDomain";
import usePosterUri from "../hooks/usePosterUri";
import { notesDomain, remindersDomain } from "../services/userData";

const CalendarContext = createContext();

// Tür renkleri — takvimdeki noktalar, açıklama çipleri ve ajanda satırları aynı
// değerleri okur. Daha önce nokta (128,0,128) ile çipler (#AF00AF) farklıydı.
export const EVENT_COLORS = {
  note: "#138DF0",
  movie: "#FF7C25",
  tv: "#AF00AF",
};

function toDateStr(date) {
  // Yerel tarih bileşenleri: toISOString UTC gösterdiği için UTC+3'te
  // 00:00-03:00 arasında "bugün" bir gün geride kalıyordu (etkinlik
  // anahtarları yerel YYYY-MM-DD formatında tutuluyor).
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const CalendarProvider = ({ children }) => {
  const { getTmdbUrl } = useImageQualitySettings();
  const posterUri = usePosterUri();

  // Takvim ayrı Firestore dinleyicisi AÇMAZ: notlar ve hatırlatıcılar profil
  // ekranlarıyla AYNI yerel kopyadan (services/userData) türetilir. Eskiden
  // burası Notes + Reminders'ı (2 + N dinleyici) ikinci kez, tüm belgeleriyle
  // okuyordu; bir not eklenince iki ekran iki ayrı yoldan güncelleniyordu.
  const notesView = useUserDataDomain(notesDomain);
  const remindersView = useUserDataDomain(remindersDomain);
  const tvReminderEpisodes = remindersView.lists.episodes; // flat list of episode docs

  // Zamanlanmış notlar → tarih bazlı harita
  const noteEvents = useMemo(() => {
    const nMap = {};
    notesView.lists.items.forEach((n) => {
      if (!n.scheduledDate) return;
      if (!nMap[n.scheduledDate]) nMap[n.scheduledDate] = [];
      nMap[n.scheduledDate].push({ ...n, eventType: "note", date: n.scheduledDate });
    });
    return nMap;
  }, [notesView]);

  // Film hatırlatıcıları → tarih bazlı harita
  const movieReminderEvents = useMemo(() => {
    const mMap = {};
    remindersView.lists.movies.forEach((m) => {
      const date = m.releaseDate;
      if (!date) return;
      if (!mMap[date]) mMap[date] = [];
      mMap[date].push({
        id:        m.movieId,
        title:     m.movieName,
        // Özel afiş yalnız filmde; dizi bölümü SEZON afişi taşır (aşağıda).
        poster:    posterUri("movie", m.movieId, m.posterPath),
        type:      "movie",
        eventType: "reminder_movie",
        date,
      });
    });
    return mMap;
  }, [remindersView, posterUri]);

  // Tüm hatırlatıcıları tek bir tarih-bazlı map olarak birleştir
  const reminderEvents = useMemo(() => {
    const rMap = {};
    Object.entries(movieReminderEvents).forEach(([d, arr]) => {
      rMap[d] = [...(rMap[d] || []), ...arr];
    });
    tvReminderEpisodes.forEach((ep) => {
      const d = ep.airDate;
      if (!d) return;
      if (!rMap[d]) rMap[d] = [];
      rMap[d].push({
        id:            ep.showId,
        episodeId:     ep.episodeId,
        seasonNumber:  ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        showName:      ep.showName,
        title:         `${ep.showName} - S${ep.seasonNumber}B${ep.episodeNumber}`,
        poster:        ep.seasonPosterPath
                         ? getTmdbUrl(ep.seasonPosterPath, "poster", 200)
                         : (ep.showPosterPath
                             ? getTmdbUrl(ep.showPosterPath, "poster", 200)
                             : null),
        type:          "tv",
        eventType:     "reminder_tv",
        date:          d,
      });
    });
    return rMap;
  }, [movieReminderEvents, tvReminderEpisodes]);

  // Yerel kopya hazır değilken (yalnız yeni cihazda tek seferlik indirme sırasında)
  // yükleniyor görünür; normal açılışta hep false.
  const isLoadingEventsBase =
    (!notesView.ready && notesView.hydrating) ||
    (!remindersView.ready && remindersView.hydrating);
  const [flash, setFlash] = useState(false);
  const isLoadingEvents = isLoadingEventsBase || flash;

  /* ── Takvim için markedDates (sadece kullanıcı verileri) ── */
  const markedDates = useMemo(() => {
    const allDates = new Set([
      ...Object.keys(noteEvents),
      ...Object.keys(reminderEvents),
    ]);
    const result = {};
    allDates.forEach((d) => {
      const dots = [];
      if (noteEvents[d]?.length) {
        dots.push({ key: "note", color: EVENT_COLORS.note });
      }
      if (reminderEvents[d]?.some((i) => i.eventType === "reminder_movie")) {
        dots.push({ key: "movie", color: EVENT_COLORS.movie });
      }
      if (reminderEvents[d]?.some((i) => i.eventType === "reminder_tv")) {
        dots.push({ key: "tv", color: EVENT_COLORS.tv });
      }
      if (dots.length) result[d] = { dots, marked: true };
    });
    return result;
  }, [noteEvents, reminderEvents]);

  /* ── Seçili günün etkinlikleri (sadece kullanıcı verileri) ── */
  const getEventsForDate = useCallback(
    (dateStr) => {
      const notes  = [...(noteEvents[dateStr] || [])];
      const movies = (reminderEvents[dateStr] || []).filter((i) => i.type === "movie");
      const tvs    = (reminderEvents[dateStr] || []).filter((i) => i.type === "tv");
      return { notes, movies, tvs };
    },
    [noteEvents, reminderEvents],
  );

  /* ── Widget: Sadece kullanıcının eklediği verilerden en yakın 3 etkinlik ── */
  const upcomingItems = useMemo(() => {
    const today = toDateStr(new Date());
    const items = [];

    Object.entries(noteEvents).forEach(([d, arr]) => {
      if (d >= today) arr.forEach((n) => items.push({ ...n, date: d }));
    });
    Object.entries(reminderEvents).forEach(([d, arr]) => {
      if (d >= today) arr.forEach((r) => items.push({ ...r, date: d }));
    });

    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  }, [noteEvents, reminderEvents]);

  const refreshEvents = useCallback(() => {
    // Veri yerel kopyadan geliyor ve her yazmada anında güncelleniyor; yenileme
    // buluta gitmez. Yalnız UI geri bildirimi için kısa flash.
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
  }, []);

  return (
    <CalendarContext.Provider
      value={{
        noteEvents,
        reminderEvents,
        markedDates,
        isLoadingEvents,
        getEventsForDate,
        upcomingItems,
        refreshEvents,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendar = () => {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendar must be used within CalendarProvider");
  return ctx;
};
