import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import React, { useRef, useEffect, useCallback } from "react";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useProfileReminders } from "../../../context/ProfileRemindersContext";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useImageQualitySettings, useListLayoutSettings } from "../../../context/AppSettingsContext";
import { i18nText } from "../../../utils/i18nText";
import Skeleton from "../../../components/Skeleton";


const { width } = Dimensions.get("window");

// ─── Tab pill boyutları (mesafe hesabı) ─────────────────────────────────────
const TAB_PILL_H = 40;
const TAB_PADDING = 3;

// ─── Geri sayım rengini ve ikonunu belirle ────────────────────────────────────
function getCountdownStyle(diff, colors) {
  if (!diff || !diff.isRemaining) {
    return {
      color: colors.green,
      background: colors.greenBackground,
      icon: "checkmark-circle",
      label: i18nText("autoI18n.yayinlandi", "Yayınlandı"),
    };
  }
  const { days, months } = diff;
  if (days < 4)
    return {
      color: colors.green,
      background: colors.greenBackground,
      icon: "flash",
      label: diff.text,
    };
  if (days < 7)
    return {
      color: colors.blue,
      background: colors.blueBackground,
      icon: "time-outline",
      label: diff.text,
    };
  if (months < 1)
    return {
      color: colors.orange,
      background: colors.orangeBackground,
      icon: "calendar",
      label: diff.text,
    };
  if (months < 3)
    return {
      color: colors.red,
      background: colors.redBackground,
      icon: "hourglass",
      label: diff.text,
    };
  return {
    color: colors.purple,
    background: colors.purpleBackground,
    icon: "ellipse",
    label: diff.text,
  };
}

// ─── Film hatırlatma kartı ────────────────────────────────────────────────────
function MovieCard({
  reminder,
  navigation,
  theme,
  formatDate,
  calculateDateDifference,
}) {
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();
  const { posterBadges } = useListLayoutSettings();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const diff = calculateDateDifference(reminder.releaseDate);
  const countdown = getCountdownStyle(diff, theme.notesColor);

  const pressIn = useCallback(
    () =>
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        speed: 30,
        bounciness: 2,
      }).start(),
    [scaleAnim],
  );

  const pressOut = useCallback(
    () =>
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 4,
      }).start(),
    [scaleAnim],
  );

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() =>
        navigation.navigate("MovieDetails", { id: reminder.movieId })
      }
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Poster */}
        <View style={styles.posterWrapper}>
          <Image
            source={{
              uri: getTmdbUrl(reminder.posterPath, 'poster', 200),
            }}
            style={styles.poster}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.75)"]}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[styles.typeBadge, { backgroundColor: theme.accent + "cc" }]}
          >
            <Ionicons name="film-outline" size={9} color="#fff" />
            <Text allowFontScaling={false} style={styles.typeBadgeText}>{i18nText("autoI18n.film_2", "FİLM")}</Text>
          </View>
        </View>

        {/* Bilgi */}
        <View style={styles.cardInfo}>
          <Text
            style={[styles.cardTitle, { color: theme.text.primary }]}
            numberOfLines={2}
          >
            {reminder.movieName}
          </Text>

          {posterBadges?.releaseDate !== false && (
            <View style={styles.infoRow}>
              <Ionicons
                name="calendar-outline"
                size={10}
                color={theme.text.muted}
              />
              <Text
                allowFontScaling={false}
                style={[styles.infoText, { color: theme.text.muted }]}
              >
                {formatDate(reminder.releaseDate)}
              </Text>
            </View>
          )}

          {reminder.movieMinutes > 0 && (
            <View style={styles.infoRow}>
              <Ionicons
                name="time-outline"
                size={10}
                color={theme.text.muted}
              />
              <Text
                allowFontScaling={false}
                style={[styles.infoText, { color: theme.text.muted }]}
              >
                {reminder.movieMinutes} dk
              </Text>
            </View>
          )}

          {posterBadges?.countdown !== false && (
            <View
              style={[
                styles.countdownBadge,
                {
                  backgroundColor: countdown.background,
                  borderColor: countdown.color,
                },
              ]}
            >
              <Ionicons name={countdown.icon} size={10} color={countdown.color} />
              <Text
                style={[styles.countdownText, { color: countdown.color }]}
                numberOfLines={1}
              >
                {countdown.label}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Dizi bölüm kartı ────────────────────────────────────────────────────────
function EpisodeCard({
  show,
  season,
  episode,
  navigation,
  theme,
  formatDate,
  calculateDateDifference,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { posterBadges } = useListLayoutSettings();
  const diff = calculateDateDifference(episode.airDate);
  const countdown = getCountdownStyle(diff, theme.colors);
  const { imageQuality, getTmdbUrl } = useImageQualitySettings();

  const pressIn = useCallback(
    () =>
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        speed: 30,
        bounciness: 2,
      }).start(),
    [scaleAnim],
  );

  const pressOut = useCallback(
    () =>
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 4,
      }).start(),
    [scaleAnim],
  );

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => navigation.navigate("TvShowsDetails", { id: show.showId })}
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Poster */}
        <View style={styles.posterWrapper}>
          <Image
            source={{
              uri: getTmdbUrl(season.seasonPosterPath, 'poster', 200),
            }}
            style={styles.poster}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.75)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.typeBadge, { backgroundColor: "#6d28d9cc" }]}>
            <Ionicons name="tv-outline" size={9} color="#fff" />
            <Text allowFontScaling={false} style={styles.typeBadgeText}>{i18nText("autoI18n.dizi_2", "DİZİ")}</Text>
          </View>
          <View
            style={[
              styles.seasonBadge,
              { backgroundColor: "rgba(0,0,0,0.65)" },
            ]}
          >
            <Text allowFontScaling={false} style={styles.seasonBadgeText}>
              S{season.seasonNumber}
            </Text>
          </View>
        </View>

        {/* Bilgi */}
        <View style={styles.cardInfo}>
          <Text
            style={[styles.cardTitle, { color: theme.text.primary }]}
            numberOfLines={1}
          >
            {show.showName}
          </Text>
          <Text
            style={[styles.cardSubTitle, { color: theme.text.secondary }]}
            numberOfLines={1}
          >
            {episode.episodeNumber}{i18nText("autoI18n.bolum_3", ". Bölüm")}</Text>

          {posterBadges?.releaseDate !== false && (
            <View style={styles.infoRow}>
              <Ionicons
                name="calendar-outline"
                size={10}
                color={theme.text.muted}
              />
              <Text
                allowFontScaling={false}
                style={[styles.infoText, { color: theme.text.muted }]}
              >
                {formatDate(episode.airDate)}
              </Text>
            </View>
          )}

          {episode.episodeMinutes > 0 && (
            <View style={styles.infoRow}>
              <Ionicons
                name="time-outline"
                size={10}
                color={theme.text.muted}
              />
              <Text
                allowFontScaling={false}
                style={[styles.infoText, { color: theme.text.muted }]}
              >
                {episode.episodeMinutes} dk
              </Text>
            </View>
          )}

          {posterBadges?.countdown !== false && (
            <View
              style={[
                styles.countdownBadge,
                {
                  backgroundColor: countdown.background,
                  borderColor: countdown.color,
                },
              ]}
            >
              <Ionicons name={countdown.icon} size={10} color={countdown.color} />
              <Text
                style={[styles.countdownText, { color: countdown.color }]}
                numberOfLines={1}
              >
                {countdown.label}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────
export default function ProfileReminders({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const {
    loading,
    activeTab,
    reminders,
    setActiveTab,
    formatDate,
    calculateDateDifference,
  } = useProfileReminders();

  // ── Tab geçiş animasyonu: translateX ile (useNativeDriver: true) ──────────
  // Tab pill genişliği yaklaşık ekran - 32px padding; her tab yarısı.
  // Tabın her birinin tam genişliğini çalışma zamanında ölçüyoruz.
  const tabPillWidth = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleTabPress = useCallback(
    (tab) => {
      setActiveTab(tab);
      const toValue = tab === "movie" ? 0 : 1;
      Animated.spring(slideAnim, {
        toValue,
        useNativeDriver: true,
        speed: 18,
        bounciness: 0,
      }).start();
    },
    [setActiveTab, slideAnim],
  );

  // İlk render'da aktif tab'a göre başlat
  useEffect(() => {
    slideAnim.setValue(activeTab === "movie" ? 0 : 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dizi remindırları: tüm (show, season, episode) üçlülerini düzleştir → tarih sıralı
  const flatTvReminders = (reminders.tvReminders || [])
    .flatMap((show) =>
      (show.seasons || []).flatMap((season) =>
        (season.episodes || []).map((episode) => ({ show, season, episode })),
      ),
    )
    .sort((a, b) => new Date(a.episode.airDate) - new Date(b.episode.airDate));

  const sortedMovieReminders = (reminders.movieReminders || [])
    .slice()
    .sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate));

  const movieCount = sortedMovieReminders.length;
  const tvCount = flatTvReminders.length;

  // translateX hesabı: pill genişliğinin yarısı kadar kaydır
  const sliderTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabPillWidth.current / 2],
  });

  return (
    <View style={styles.section}>
      {/* ── Başlık ── */}
      <View style={styles.headerRow}>
        <Text
          allowFontScaling={false}
          style={[styles.sectionTitle, { color: theme.text.muted }]}
        >
          {t.profileScreen.ProfileReminder.reminder}
        </Text>
        <View style={styles.countRow}>
          {movieCount > 0 && (
            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor: theme.notesColor.blueBackground,
                  borderColor: theme.notesColor.blue,
                },
              ]}
            >
              <Ionicons
                name="film-outline"
                size={10}
                color={theme.notesColor.blue}
              />
              <Text
                style={[
                  styles.countBadgeText,
                  { color: theme.notesColor.blue },
                ]}
              >
                {movieCount}
              </Text>
            </View>
          )}
          {tvCount > 0 && (
            <View
              style={[
                styles.countBadge,
                {
                  backgroundColor: theme.notesColor.purpleBackground,
                  borderColor: theme.notesColor.purple,
                },
              ]}
            >
              <Ionicons
                name="tv-outline"
                size={10}
                color={theme.notesColor.purple}
              />
              <Text
                style={[
                  styles.countBadgeText,
                  { color: theme.notesColor.purple },
                ]}
              >
                {tvCount}
              </Text>
            </View>
          )}

          {/* Takvim butonu — profil önizleme başlığındakiyle aynı */}
          <TouchableOpacity
            style={[styles.calendarBtn, { backgroundColor: theme.accent + "22" }]}
            onPress={() => navigation.navigate("CalendarScreen")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="calendar" size={15} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tab pill ── */}
      <View
        style={[
          styles.tabPill,
          { backgroundColor: theme.secondary, borderColor: theme.border },
        ]}
        onLayout={(e) => {
          tabPillWidth.current = e.nativeEvent.layout.width - TAB_PADDING * 2;
        }}
      >
        {/* Sliding indicator – translateX ile kasma yok */}
        <Animated.View
          style={[
            styles.tabSlider,
            {
              backgroundColor: theme.accent,
              transform: [{ translateX: sliderTranslateX }],
            },
          ]}
        />

        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => handleTabPress("movie")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="film-outline"
            size={13}
            color={activeTab === "movie" ? "#fff" : theme.text.muted}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "movie" ? "#fff" : theme.text.muted },
            ]}
          >
            {t.profileScreen.ProfileReminder.movieReminder}
          </Text>
          {movieCount > 0 && (
            <View
              style={[
                styles.tabBadge,
                {
                  backgroundColor:
                    activeTab === "movie" ? "#ffffff33" : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  { color: activeTab === "movie" ? "#fff" : theme.text.muted },
                ]}
              >
                {movieCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => handleTabPress("tv")}
          activeOpacity={0.8}
        >
          <Ionicons
            name="tv-outline"
            size={13}
            color={activeTab === "tv" ? "#fff" : theme.text.muted}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "tv" ? "#fff" : theme.text.muted },
            ]}
          >
            {t.profileScreen.ProfileReminder.tvSeriesReminder}
          </Text>
          {tvCount > 0 && (
            <View
              style={[
                styles.tabBadge,
                {
                  backgroundColor:
                    activeTab === "tv" ? "#ffffff33" : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabBadgeText,
                  { color: activeTab === "tv" ? "#fff" : theme.text.muted },
                ]}
              >
                {tvCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Liste ── */}
      {loading ? (
        <ReminderGridSkeleton />
      ) : activeTab === "movie" ? (
        sortedMovieReminders.length > 0 ? (
          <View style={styles.gridWrap}>
            {sortedMovieReminders.map((reminder) => (
              <MovieCard
                key={reminder.movieId}
                reminder={reminder}
                navigation={navigation}
                theme={theme}
                formatDate={formatDate}
                calculateDateDifference={calculateDateDifference}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="film-outline" size={32} color={theme.text.muted} />
            <Text
              allowFontScaling={false}
              style={[styles.emptyText, { color: theme.text.muted }]}
            >
              {t.profileScreen.ProfileReminder.noMovieReminder}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.emptyHint, { color: theme.text.muted }]}
            >{i18nText("autoI18n.film_detay_sayfasindan_hatirlatici_ekleyebilirsin", "Film detay sayfasından hatırlatıcı ekleyebilirsin.")}</Text>
          </View>
        )
      ) : flatTvReminders.length > 0 ? (
        <View style={styles.gridWrap}>
          {flatTvReminders.map(({ show, season, episode }, idx) => (
            <EpisodeCard
              key={
                episode.episodeId ||
                `${show.showId}-${season.seasonNumber}-${episode.episodeNumber}-${idx}`
              }
              show={show}
              season={season}
              episode={episode}
              navigation={navigation}
              theme={theme}
              formatDate={formatDate}
              calculateDateDifference={calculateDateDifference}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="tv-outline" size={32} color={theme.text.muted} />
          <Text
            allowFontScaling={false}
            style={[styles.emptyText, { color: theme.text.muted }]}
          >
            {t.profileScreen.ProfileReminder.noTvSeriesReminder}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.emptyHint, { color: theme.text.muted }]}
          >{i18nText("autoI18n.dizi_detay_sayfasindan_hatirlatici_ekleyebilirsin", "Dizi detay sayfasından hatırlatıcı ekleyebilirsin.")}</Text>
        </View>
      )}
    </View>
  );
}

const GRID_COLS = 3;
const GRID_PAD = 14;
const GRID_GAP = 10;
const CARD_W = (width - GRID_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const CARD_H = CARD_W * 1.62;

// İlk yükleme: 3 sütunlu poster grid iskeleti (gerçek hatırlatma kartlarıyla aynı ölçü).
function ReminderGridSkeleton() {
  return (
    <View style={styles.gridWrap}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} width={CARD_W} height={CARD_H} style={{ borderRadius: 14 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: "100%", marginBottom: 14 },

  /* Başlık */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 13, textTransform: "uppercase", letterSpacing: 1 },

  countRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  calendarBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  countBadgeText: { fontSize: 11, fontWeight: "700" },

  /* Tab pill */
  tabPill: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    padding: TAB_PADDING,
    height: TAB_PILL_H,
  },
  tabSlider: {
    position: "absolute",
    top: TAB_PADDING,
    bottom: TAB_PADDING,
    left: TAB_PADDING,
    width: "50%",
    borderRadius: 11,
    zIndex: 0,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    zIndex: 1,
    borderRadius: 11,
  },
  tabText: { fontSize: 12, fontWeight: "600" },
  tabBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabBadgeText: { fontSize: 10, fontWeight: "700" },

  /* Liste */
  listContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  gridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: GRID_PAD,
    gap: GRID_GAP,
    paddingBottom: 8,
  },

  /* Kart */
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },

  /* Poster */
  posterWrapper: {
    position: "absolute",
    width: CARD_W,
    height: CARD_H,
  },
  poster: { width: "100%", height: "100%" },
  typeBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 8,
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  seasonBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  seasonBadgeText: { fontSize: 9, color: "#fff", fontWeight: "700" },

  /* Kart bilgi */
  cardInfo: { flex: 1, justifyContent: "flex-end", padding: 9, gap: 2 },
  cardTitle: { fontSize: 11, fontWeight: "700", lineHeight: 16 },
  cardSubTitle: { fontSize: 10, fontWeight: "500" },

  infoRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 9 },

  /* Geri sayım */
  countdownBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.7,
    alignSelf: "flex-start",
  },
  countdownText: { fontSize: 9, fontWeight: "700" },

  /* Boş durum */
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyText: { fontSize: 13, fontWeight: "600" },
  emptyHint: { fontSize: 11, textAlign: "center", opacity: 0.7 },
});
