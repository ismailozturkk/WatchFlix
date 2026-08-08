// screens/tabs/UpNextScreen.js
//
// Sıradaki bölüm listesinin TAM görünümü. Artık sekme değil, TV ana ekranındaki
// "Devam Eden Dizilerim" rayının "Tümü" düğmesinden (ve seelogd://upnext derin
// bağlantısından) açılan bir yığın ekranı.
//
// Kuyruk mantığı burada durmaz: çözümleme, iyimser ilerletme, gizleme
// tercihleri ve işaretleme hooks/useUpNextQueue'da — ray ile paylaşılır. Bu
// ekranda kalan tek fazlalık dizi YÖNETİMİ (gizle/göster) ve geniş kart.

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import BackButton from "@components/BackButton";
import BottomSheetModal from "@components/common/BottomSheetModal";
import WatchedDateSheet from "@components/detail/WatchedDateSheet";
import PosterImage from "@components/PosterImage";
import ScreenDecor from "@components/ScreenDecor";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import useUpNextQueue, { localWatchDate } from "@hooks/useUpNextQueue";
import { alpha } from "@theme/colors";

const copyFor = (language) =>
  language === "en"
    ? {
        title: "Up Next",
        subtitle: "Continue every show from the right episode.",
        recentOrder: "Ordered by your most recently watched shows",
        minuteShort: "min",
        episodesWatched: "episodes watched",
        upcoming: "Coming soon",
        watchedNow: "Watched now",
        chooseDate: "Choose date",
        dateSubtitle: "When did you watch this episode?",
        manage: "Manage",
        manageTitle: "Choose ongoing shows",
        manageSubtitle: "Hidden shows stay in your history and statistics.",
        showAll: "Show all",
        visible: "Shown",
        hidden: "Hidden",
        done: "Done",
        emptyTitle: "Nothing is waiting yet",
        emptyText:
          "Mark an episode as watched and its next episode will appear here.",
        emptyHiddenTitle: "No ongoing show is selected",
        emptyHiddenText: "Choose which shows should appear in Up Next.",
        discover: "Discover shows",
        loadError: "Some shows could not be refreshed.",
        retry: "Try again",
      }
    : {
        title: "Sıradaki",
        subtitle: "Tüm dizilerine doğru bölümden devam et.",
        recentOrder: "En son izlediğin dizilere göre sıralandı",
        minuteShort: "dk",
        episodesWatched: "bölüm izlendi",
        upcoming: "Yakında",
        watchedNow: "Şimdi izledim",
        chooseDate: "Tarih seç",
        dateSubtitle: "Bu bölümü ne zaman izledin?",
        manage: "Dizileri yönet",
        manageTitle: "Devam eden dizilerini seç",
        manageSubtitle:
          "Gizlenen diziler geçmişinden ve istatistiklerinden silinmez.",
        showAll: "Tümünü göster",
        visible: "Gösteriliyor",
        hidden: "Gizli",
        done: "Bitti",
        emptyTitle: "Şimdilik bekleyen bölüm yok",
        emptyText:
          "Bir bölümü izledim olarak işaretlediğinde sıradaki bölüm burada görünür.",
        emptyHiddenTitle: "Devam eden dizi seçmedin",
        emptyHiddenText: "Sıradaki bölümünde görmek istediğin dizileri seç.",
        discover: "Dizi keşfet",
        loadError: "Bazı diziler yenilenemedi.",
        retry: "Tekrar dene",
      };
// NOT: kaydetme/hata bildirimleri artık hooks/useUpNextQueue'da (i18nText ile),
// çünkü aynı toast'ları TV ana ekranındaki ray da gösteriyor.

const formatShortDate = (value, language) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "tr-TR", {
    day: "numeric",
    month: "short",
  }).format(date);
};

function EpisodeRow({
  item,
  language,
  labels,
  theme,
  onOpen,
  onWatchedNow,
  onChooseDate,
  onHide,
}) {
  const dateLabel = formatShortDate(item.airDate, language);
  const accent = item.isAired
    ? theme.accent
    : theme.colors?.orange || "#FF9500";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: alpha(theme.secondary, 0.9),
          borderColor: alpha(theme.border || theme.text.muted, 0.72),
          opacity: pressed ? 0.94 : 1,
        },
      ]}
    >
      <View style={styles.posterWrap}>
        <PosterImage
          path={item.showPosterPath}
          type="tv"
          size={342}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          recyclingKey={`up-next-${item.showId}`}
        />
        <View style={styles.posterShade} />
        <View style={styles.episodePill}>
          <Text style={styles.episodePillText}>
            S{item.seasonNumber} · B{item.episodeNumber}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text
              numberOfLines={1}
              style={[styles.showName, { color: theme.text.primary }]}
            >
              {item.showName}
            </Text>
            {!!item.episodeName && (
              <Text
                numberOfLines={2}
                style={[styles.episodeName, { color: theme.text.secondary }]}
              >
                {item.episodeName}
              </Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labels.hidden}
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation?.();
              onHide();
            }}
            style={({ pressed }) => [
              styles.hideButton,
              {
                backgroundColor: pressed
                  ? alpha(theme.text.muted, 0.18)
                  : alpha(theme.text.muted, 0.1),
              },
            ]}
          >
            <Ionicons
              name="eye-off-outline"
              size={16}
              color={theme.text.muted}
            />
          </Pressable>
        </View>

        <View style={styles.metaRow}>
          {!!dateLabel && (
            <Text style={[styles.metaText, { color: theme.text.muted }]}>
              {dateLabel}
            </Text>
          )}
          {!!item.episodeMinutes && (
            <Text style={[styles.metaText, { color: theme.text.muted }]}>
              · {item.episodeMinutes} {labels.minuteShort}
            </Text>
          )}
          <Text style={[styles.metaText, { color: theme.text.muted }]}>
            · {item.watchedEpisodeCount} {labels.episodesWatched}
          </Text>
        </View>

        {!item.isAired ? (
          <View
            style={[
              styles.upcomingBar,
              { backgroundColor: alpha(accent, 0.13) },
            ]}
          >
            <Ionicons name="time-outline" size={14} color={accent} />
            <Text style={[styles.upcomingText, { color: accent }]}>
              {labels.upcoming}
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.actionDivider,
                { backgroundColor: alpha(theme.border, 0.72) },
              ]}
            />
            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation?.();
                  onWatchedNow();
                }}
                style={({ pressed }) => [
                  styles.primaryAction,
                  { backgroundColor: pressed ? alpha(accent, 0.75) : accent },
                ]}
              >
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text numberOfLines={1} style={styles.primaryActionText}>
                  {labels.watchedNow}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation?.();
                  onChooseDate();
                }}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  {
                    backgroundColor: pressed
                      ? alpha(theme.accent, 0.14)
                      : alpha(theme.primary, 0.4),
                    borderColor: alpha(theme.accent, 0.45),
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={15}
                  color={theme.accent}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.secondaryActionText, { color: theme.accent }]}
                >
                  {labels.chooseDate}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}

function ManageShowsModal({
  visible,
  shows,
  hiddenShowIds,
  labels,
  theme,
  onToggle,
  onShowAll,
  onClose,
}) {
  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[
        styles.manageSheet,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
          <View
            style={[styles.sheetHandle, { backgroundColor: theme.border }]}
          />
          <View style={styles.manageHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.manageTitle, { color: theme.text.primary }]}>
                {labels.manageTitle}
              </Text>
              <Text
                style={[styles.manageSubtitle, { color: theme.text.muted }]}
              >
                {labels.manageSubtitle}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.between }]}
            >
              <Ionicons name="close" size={19} color={theme.text.secondary} />
            </Pressable>
          </View>

          {hiddenShowIds.size > 0 && (
            <Pressable
              onPress={onShowAll}
              style={[
                styles.showAllButton,
                { backgroundColor: alpha(theme.accent, 0.12) },
              ]}
            >
              <Ionicons name="eye-outline" size={16} color={theme.accent} />
              <Text style={[styles.showAllText, { color: theme.accent }]}>
                {labels.showAll}
              </Text>
            </Pressable>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.manageList}
          >
            {shows.map((show) => {
              const hidden = hiddenShowIds.has(String(show.id));
              return (
                <Pressable
                  key={String(show.id)}
                  onPress={() => onToggle(show.id)}
                  style={[
                    styles.manageRow,
                    {
                      backgroundColor: hidden
                        ? alpha(theme.primary, 0.36)
                        : alpha(theme.accent, 0.08),
                      borderColor: hidden
                        ? theme.border
                        : alpha(theme.accent, 0.3),
                    },
                  ]}
                >
                  <PosterImage
                    path={show.imagePath}
                    type="tv"
                    size={200}
                    style={styles.managePoster}
                    contentFit="cover"
                    recyclingKey={`up-next-manage-${show.id}`}
                  />
                  <View style={styles.manageRowCopy}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.manageShowName,
                        { color: theme.text.primary },
                      ]}
                    >
                      {show.name}
                    </Text>
                    <Text
                      style={[
                        styles.manageStateText,
                        { color: hidden ? theme.text.muted : theme.accent },
                      ]}
                    >
                      {hidden ? labels.hidden : labels.visible}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.visibilityToggle,
                      {
                        backgroundColor: hidden ? theme.between : theme.accent,
                        borderColor: hidden ? theme.border : theme.accent,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleThumb,
                        { alignSelf: hidden ? "flex-start" : "flex-end" },
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={[styles.doneButton, { backgroundColor: theme.accent }]}
          >
            <Text style={styles.doneText}>{labels.done}</Text>
          </Pressable>
    </BottomSheetModal>
  );
}

export default function UpNextScreen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const labels = useMemo(() => copyFor(language), [language]);
  const [dateItem, setDateItem] = useState(null);
  const [manageVisible, setManageVisible] = useState(false);

  // Kuyruğun tamamı: ray ilk 10 diziyi çözer, burada 30'a kadar çıkılır.
  // Ray ile aynı çözümleme önbelleğini paylaştığı için ana ekranda çözülmüş
  // diziler burada anında hazır gelir.
  const {
    allShows,
    items: visibleItems,
    hiddenShowIds,
    loading,
    refreshing,
    failedCount,
    readyCount,
    allHidden,
    refresh: handleRefresh,
    markWatched: handleWatched,
    toggleShow: handleToggleShow,
    showAll: handleShowAll,
  } = useUpNextQueue({ limit: 30, surface: "screen" });

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScreenDecor iconOpacity={0.11} />
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={styles.header}>
          {/* Sekme değil yığın ekranı: geri okunu ekran kendi taşır
              (headerShown:false). */}
          <BackButton absolute={false} />
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: theme.text.primary }]}>
              {labels.title}
            </Text>
            <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
              {labels.subtitle}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labels.manage}
            onPress={() => setManageVisible(true)}
            style={({ pressed }) => [
              styles.manageButton,
              {
                backgroundColor: pressed
                  ? alpha(theme.accent, 0.2)
                  : alpha(theme.accent, 0.12),
                borderColor: alpha(theme.accent, 0.28),
              },
            ]}
          >
            <Ionicons name="options-outline" size={18} color={theme.accent} />
            {readyCount > 0 && (
              <View
                style={[styles.manageCount, { backgroundColor: theme.accent }]}
              >
                <Text style={styles.manageCountText}>{readyCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : visibleItems.length === 0 ? (
          <View style={styles.center}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: alpha(theme.accent, 0.12) },
              ]}
            >
              <Ionicons
                name={
                  allHidden ? "eye-off-outline" : "play-skip-forward-outline"
                }
                size={34}
                color={theme.accent}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
              {allHidden ? labels.emptyHiddenTitle : labels.emptyTitle}
            </Text>
            <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
              {allHidden ? labels.emptyHiddenText : labels.emptyText}
            </Text>
            <Pressable
              onPress={() => {
                if (allHidden) setManageVisible(true);
                else {
                  navigation.navigate("UnifiedSearch", {
                    initialType: "tv",
                    autoFocus: true,
                  });
                }
              }}
              style={[styles.discoverButton, { backgroundColor: theme.accent }]}
            >
              <Ionicons
                name={allHidden ? "options-outline" : "search"}
                size={17}
                color="#fff"
              />
              <Text style={styles.discoverText}>
                {allHidden ? labels.manage : labels.discover}
              </Text>
            </Pressable>
            {failedCount > 0 && (
              <Pressable onPress={handleRefresh} style={styles.retryButton}>
                <Text style={[styles.retryText, { color: theme.text.muted }]}>
                  {labels.retry}
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <FlatList
            data={visibleItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.accent}
              />
            }
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={theme.text.muted}
                />
                <Text
                  style={[styles.sectionLabel, { color: theme.text.muted }]}
                >
                  {failedCount > 0 ? labels.loadError : labels.recentOrder}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <EpisodeRow
                item={item}
                language={language}
                labels={labels}
                theme={theme}
                onOpen={() =>
                  navigation.push("TvShowsDetails", { id: item.showId })
                }
                onWatchedNow={() => handleWatched(item, localWatchDate())}
                onChooseDate={() => setDateItem(item)}
                onHide={() => handleToggleShow(item.showId)}
              />
            )}
          />
        )}
      </SafeAreaView>

      <ManageShowsModal
        visible={manageVisible}
        shows={allShows}
        hiddenShowIds={hiddenShowIds}
        labels={labels}
        theme={theme}
        onToggle={handleToggleShow}
        onShowAll={handleShowAll}
        onClose={() => setManageVisible(false)}
      />

      <WatchedDateSheet
        visible={!!dateItem}
        onClose={() => setDateItem(null)}
        subtitle={
          dateItem
            ? `${dateItem.showName} · S${dateItem.seasonNumber} B${dateItem.episodeNumber}`
            : labels.dateSubtitle
        }
        pickerSubtitle={labels.dateSubtitle}
        releaseDate={dateItem?.airDate || undefined}
        minDate={dateItem?.airDate || undefined}
        mediaType="tv"
        onConfirm={(date) => {
          const selectedItem = dateItem;
          if (!selectedItem) return;
          // Kart arkada zaten anında ilerliyor; sayfa kaydı beklemeden kapanır.
          setDateItem(null);
          handleWatched(selectedItem, date);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  manageButton: {
    width: 43,
    height: 43,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  manageCount: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  manageCountText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  // Alt boşluklar sekme çubuğu için ayrılmıştı; ekran yığına taşındığından
  // yalnızca rahat bir kaydırma payı kalıyor.
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingBottom: 40,
  },
  list: { paddingHorizontal: 14, paddingBottom: 40 },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "700",
  },
  card: {
    flexDirection: "row",
    height: 180,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 13,
    // Afiş kartın kenarına yapışmasın: iç boşluk + eşmerkezli köşe yarıçapı
    // (22 - 10 = 12) afişi kartın içinde yüzen bir blok gibi gösteriyor.
    padding: 10,
    overflow: "hidden",
  },
  posterWrap: {
    width: 104,
    height: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  posterShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  episodePill: {
    position: "absolute",
    left: 8,
    bottom: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  episodePillText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  body: { flex: 1, minWidth: 0, paddingLeft: 12, paddingVertical: 3 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  titleCopy: { flex: 1, minWidth: 0 },
  showName: { fontSize: 16, fontWeight: "900" },
  episodeName: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 5,
  },
  hideButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  metaText: { fontSize: 10, fontWeight: "600" },
  upcomingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 38,
    borderRadius: 12,
    marginTop: "auto",
  },
  upcomingText: { fontSize: 12, fontWeight: "900" },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: "auto",
    marginBottom: 9,
  },
  actionRow: { flexDirection: "row", gap: 7 },
  primaryAction: {
    flex: 1.15,
    minHeight: 38,
    paddingHorizontal: 8,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  primaryActionText: { color: "#fff", fontSize: 10.5, fontWeight: "900" },
  secondaryAction: {
    flex: 0.85,
    minHeight: 38,
    paddingHorizontal: 7,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  secondaryActionText: { fontSize: 10.5, fontWeight: "900" },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: { fontSize: 19, fontWeight: "900", textAlign: "center" },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 310,
  },
  discoverButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: 14,
    marginTop: 20,
  },
  discoverText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  retryButton: { padding: 12, marginTop: 4 },
  retryText: { fontSize: 12, fontWeight: "700" },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  manageSheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  manageHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  manageTitle: { fontSize: 19, fontWeight: "900" },
  manageSubtitle: { fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  showAllButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    minHeight: 34,
    borderRadius: 11,
    marginTop: 14,
  },
  showAllText: { fontSize: 11.5, fontWeight: "850" },
  manageList: { paddingTop: 14, paddingBottom: 10, gap: 9 },
  manageRow: {
    minHeight: 66,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  managePoster: { width: 38, height: 52, borderRadius: 9 },
  manageRowCopy: { flex: 1, minWidth: 0, paddingHorizontal: 11 },
  manageShowName: { fontSize: 13.5, fontWeight: "800" },
  manageStateText: { fontSize: 10.5, fontWeight: "700", marginTop: 4 },
  visibilityToggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    padding: 2,
    justifyContent: "center",
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
  },
  doneButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  doneText: { color: "#fff", fontSize: 13.5, fontWeight: "900" },
});
