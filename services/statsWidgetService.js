import { callWidget } from "./widgetBridge";

/**
 * "İstatistikler" ana ekran widget'ının veri katmanı.
 *
 * Profildeki istatistik bölümünün (screens/tabs/profile/StatisticsSection.js)
 * birebir karşılığı: film kartı + toplam süre şeridi + dizi kartı.
 *
 * i18n ve sayı biçimlendirme TAMAMEN burada yapılır; native taraf yalnız hazır
 * metinleri bağlar. Widget'ın kendi dil/locale altyapısı yok ve olmamalı —
 * uygulama dili değişince payload yeniden gönderilir.
 *
 * Payload sözleşmesi (Android StatsWidgetProvider.kt / iOS stats-widget.swift):
 *   { movie: {...}, tv: {...}, duration: {...}, units: {...} }
 */

const ANDROID_MODULE = "StatsWidgetModule";

const localeOf = (language) => (language === "tr" ? "tr-TR" : "en-US");

const num = (value, language) =>
  Number(value || 0).toLocaleString(localeOf(language));

// Profildeki formatTotalDurationTime'ın "hours" modu. Widget'ta mod
// değiştirilemediği için saat sabit seçildi: dakika çok uzun, gün çok kaba.
const durationText = (minutes, language, hoursLabel) =>
  `${num(Math.floor(Number(minutes || 0) / 60), language)} ${hoursLabel}`;

// formatTime'ın (ProfileStatsContext) çıktısı; alan eksikse 0'a düşer.
const timeParts = (time) => ({
  years: Number(time?.years || 0),
  months: Number(time?.months || 0),
  days: Number(time?.days || 0),
  hours: Number(time?.hours || 0),
  minutes: Number(time?.minutes || 0),
});

/**
 * @param {object} stats ProfileStatsContext'ten türetilen ham değerler
 * @param {string} language "tr" | "en"
 */
export const buildStatsWidgetPayload = (stats = {}, language = "tr") => {
  const labels = stats.labels || {};
  const hoursLabel = labels.hours || (language === "tr" ? "Saat" : "Hours");
  const movieMinutes = Number(stats.movieMinutes || 0);
  const tvMinutes = Number(stats.tvMinutes || 0);

  return {
    title: labels.sectionTitle || (language === "tr" ? "İstatistikler" : "Statistics"),
    movie: {
      count: num(stats.movieCount, language),
      countLabel: labels.movieWatched || "",
      time: timeParts(stats.movieTime),
    },
    tv: {
      showCount: num(stats.tvShowCount, language),
      showCountLabel: labels.tvShowCount || "",
      episodeCount: num(stats.episodeCount, language),
      episodeCountLabel: labels.tvShowEpisodeCount || "",
      time: timeParts(stats.tvTime),
    },
    duration: {
      totalText: durationText(movieMinutes + tvMinutes, language, hoursLabel),
      totalLabel: labels.totalDuration || "",
      movieText: durationText(movieMinutes, language, hoursLabel),
      // "Filmler 7 hafta" — profildeki `t.movies + rankNameMovie` ile aynı.
      movieLabel: [labels.movies, stats.movieRankName].filter(Boolean).join(" "),
      movieAccent: stats.movieAccent || "#4fc3f7",
      tvText: durationText(tvMinutes, language, hoursLabel),
      tvLabel: [labels.tvShows, stats.tvRankName].filter(Boolean).join(" "),
      tvAccent: stats.tvAccent || "#a78bfa",
    },
    units: {
      years: labels.years || "",
      months: labels.months || "",
      days: labels.days || "",
      hours: hoursLabel,
      minutes: labels.minutes || "",
    },
  };
};

export const syncStatsWidget = (stats, language = "tr") =>
  callWidget(
    ANDROID_MODULE,
    "updateStats",
    JSON.stringify(buildStatsWidgetPayload(stats, language)),
    language,
  );

export const clearStatsWidget = () => callWidget(ANDROID_MODULE, "clearStats");
