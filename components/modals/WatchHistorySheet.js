import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomSheetModal from "../common/BottomSheetModal";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { selectionAsync } from "../../services/hapticsService";

const scopeMeta = (scope) => {
  if (scope === "show") {
    return { label: i18nText("autoI18n.tum_dizi", "Tüm dizi"), icon: "television-play", color: "#A78BFA" };
  }
  if (scope === "season") {
    return { label: i18nText("autoI18n.sezon", "Sezon"), icon: "animation-play-outline", color: "#60A5FA" };
  }
  if (scope === "episode") {
    return { label: i18nText("autoI18n.bolum", "Bölüm"), icon: "play-box-outline", color: "#34D399" };
  }
  if (scope === "movie") {
    return { label: i18nText("autoI18n.film", "Film"), icon: "movie-open-outline", color: "#F59E0B" };
  }
  return { label: i18nText("autoI18n.izleme_kaydi", "İzleme kaydı"), icon: "history", color: "#A78BFA" };
};

const formatDuration = (minutes) => {
  const total = Math.max(0, Number(minutes) || 0);
  if (!total) return null;
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${remainder} dk`;
  return remainder ? `${hours} sa ${remainder} dk` : `${hours} sa`;
};

function HistoryEventCard({
  event,
  index,
  total,
  visible,
  confirming,
  deleting,
  disabled,
  formatDate,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}) {
  const { theme } = useTheme();
  const entrance = useRef(new Animated.Value(0)).current;
  const meta = scopeMeta(event?.scope);

  useEffect(() => {
    if (!visible) {
      entrance.setValue(0);
      return undefined;
    }
    const animation = Animated.spring(entrance, {
      toValue: 1,
      delay: Math.min(index, 7) * 42,
      damping: 18,
      stiffness: 175,
      mass: 0.8,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [entrance, index, visible]);

  const details = [
    event?.episodeCount > 0
      ? i18nText("autoI18n.n_bolum", "{{count}} bölüm", { count: event.episodeCount })
      : null,
    event?.seasonCount > 0
      ? `${event.seasonCount} ${i18nText("autoI18n.sezon", "sezon")}`
      : null,
    formatDuration(event?.minutes),
  ].filter(Boolean);

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          {
            translateY: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 0],
            }),
          },
          {
            scale: entrance.interpolate({
              inputRange: [0, 1],
              outputRange: [0.97, 1],
            }),
          },
        ],
      }}
    >
      <View
        style={[
          styles.eventCard,
          {
            backgroundColor: confirming ? alpha("#FB7185", 0.08) : theme.between,
            borderColor: confirming ? alpha("#FB7185", 0.38) : theme.border,
          },
        ]}
      >
        <View style={styles.eventMainRow}>
          <View style={[styles.scopeIcon, { backgroundColor: alpha(meta.color, 0.15) }]}>
            <MaterialCommunityIcons name={meta.icon} size={20} color={meta.color} />
          </View>

          <View style={styles.eventCopy}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.eventDate, { color: theme.text.primary }]}
            >
              {formatDate(event?.watchedAt)}
            </Text>
            <View style={styles.eventMetaRow}>
              <View style={[styles.scopePill, { backgroundColor: alpha(meta.color, 0.12) }]}>
                <Text style={[styles.scopePillText, { color: meta.color }]}>{meta.label}</Text>
              </View>
              {details.length ? (
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.eventDetails, { color: theme.text.muted }]}
                >
                  {details.join(" · ")}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.orderBadge, { borderColor: theme.border }]}>
            <Text style={[styles.orderText, { color: theme.text.muted }]}>#{total - index}</Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.sil", "Sil")}
            disabled={disabled || deleting}
            onPress={() => onAskDelete(event)}
            style={[styles.deleteIconButton, { backgroundColor: alpha("#FB7185", 0.11) }]}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#FB7185" />
            ) : (
              <Ionicons name="trash-outline" size={17} color="#FB7185" />
            )}
          </TouchableOpacity>
        </View>

        {confirming ? (
          <View style={[styles.confirmStrip, { borderTopColor: theme.border }]}>
            <View style={styles.confirmCopy}>
              <Ionicons name="warning-outline" size={18} color="#FB7185" />
              <Text style={[styles.confirmMessage, { color: theme.text.secondary }]}>
                {i18nText(
                  "autoI18n.izleme_kaydini_sil_onay",
                  "Bu izleme kaydı kalıcı olarak silinsin mi?",
                )}
              </Text>
            </View>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                disabled={deleting}
                onPress={onCancelDelete}
                style={[styles.confirmButton, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.cancelText, { color: theme.text.secondary }]}>
                  {i18nText("autoI18n.iptal", "İptal")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={deleting}
                onPress={() => onConfirmDelete(event)}
                style={[styles.confirmButton, styles.destructiveButton]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="trash" size={15} color="#FFFFFF" />
                )}
                <Text style={styles.destructiveText}>
                  {i18nText("autoI18n.kaydi_sil", "Kaydı sil")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function WatchHistorySheet({
  visible,
  onClose,
  title,
  events = [],
  onAddAgain,
  onDeleteEvent,
  busy = false,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const resetTimer = useRef(null);
  const locale = language === "tr" ? "tr-TR" : "en-US";

  useEffect(() => {
    if (visible) return undefined;
    resetTimer.current = setTimeout(() => {
      setConfirmingId(null);
      setDeletingId(null);
      resetTimer.current = null;
    }, 300);
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, [visible]);

  const formatDate = (value) => {
    if (!value) return i18nText("autoI18n.tarih_bilinmiyor", "Tarih bilinmiyor");
    const raw = String(value);
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw);
    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const summary = useMemo(() => {
    const minutes = events.reduce((sum, event) => sum + (Number(event?.minutes) || 0), 0);
    const episodes = events.reduce((sum, event) => sum + (Number(event?.episodeCount) || 0), 0);
    return { minutes, episodes };
  }, [events]);

  const closeSheet = () => {
    if (busy || deletingId) return;
    if (confirmingId) {
      setConfirmingId(null);
      return;
    }
    onClose?.();
  };

  const askDelete = (event) => {
    if (busy || deletingId || !event?.id) return;
    setConfirmingId(event.id);
    selectionAsync().catch(() => {});
  };

  const confirmDelete = async (event) => {
    if (busy || deletingId || !event?.id) return;
    setDeletingId(event.id);
    try {
      await onDeleteEvent?.(event);
      setConfirmingId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const headerMeta = scopeMeta(events[0]?.scope || "history");

  return (
    <BottomSheetModal
      visible={visible}
      onClose={closeSheet}
      intensity={54}
      dimColor="rgba(0,0,0,0.48)"
      dismissOnBackdropPress={!busy && !deletingId}
      liftWithKeyboard={false}
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          paddingBottom: Math.max(insets.bottom + 18, 30),
        },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        <LinearGradient
          colors={[alpha(headerMeta.color, 0.24), alpha(theme.accent, 0.08)]}
          style={styles.headerIcon}
        >
          <MaterialCommunityIcons name="history" size={23} color={headerMeta.color} />
        </LinearGradient>
        <View style={styles.headerCopy}>
          <Text
            allowFontScaling={false}
            style={[styles.title, { color: theme.text.primary }]}
            numberOfLines={1}
          >
            {title || i18nText("autoI18n.izleme_gecmisi", "İzleme geçmişi")}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.subtitle, { color: theme.text.muted }]}
            numberOfLines={2}
          >
            {i18nText(
              "autoI18n.izleme_kaydi_aciklama",
              "Tekrar izleme ekleyebilir veya kayıtlarını yönetebilirsin.",
            )}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.kapat", "Kapat")}
          disabled={busy || !!deletingId}
          onPress={closeSheet}
          style={[styles.closeButton, { backgroundColor: theme.between }]}
        >
          <Ionicons name="close" size={18} color={theme.text.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard icon="layers-outline" value={events.length} label={i18nText("autoI18n.kayit", "Kayıt")} color={headerMeta.color} />
        <SummaryCard icon="play-skip-forward-outline" value={summary.episodes || "—"} label={i18nText("autoI18n.bolum", "Bölüm")} color="#34D399" />
        <SummaryCard icon="time-outline" value={formatDuration(summary.minutes) || "—"} label={i18nText("autoI18n.sure", "Süre")} color="#F59E0B" compact />
      </View>

      <TouchableOpacity
        disabled={busy || !!deletingId}
        onPress={onAddAgain}
        activeOpacity={0.86}
        style={styles.againWrap}
      >
        <LinearGradient
          colors={[theme.accent, headerMeta.color]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.againButton}
        >
          <View style={styles.againIcon}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.againCopy}>
            <Text allowFontScaling={false} style={styles.againText}>
              {i18nText("autoI18n.tekrar_izlendi_ekle", "Yeni izleme kaydı ekle")}
            </Text>
            <Text allowFontScaling={false} style={styles.againSubtitle}>
              {i18nText("autoI18n.farkli_tarih_sec", "Farklı bir izleme tarihi seç")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: theme.text.secondary }]}>
          {i18nText("autoI18n.kayitli_izlemeler", "Kayıtlı izlemeler")}
        </Text>
        <View style={[styles.countPill, { backgroundColor: theme.between }]}>
          <Text style={[styles.countText, { color: theme.text.muted }]}>{events.length}</Text>
        </View>
      </View>

      <FlatList
        data={events}
        keyExtractor={(event, index) => String(event?.id || index)}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => (
          <HistoryEventCard
            event={item}
            index={index}
            total={events.length}
            visible={visible}
            confirming={confirmingId === item?.id}
            deleting={deletingId === item?.id}
            disabled={busy || (!!deletingId && deletingId !== item?.id)}
            formatDate={formatDate}
            onAskDelete={askDelete}
            onCancelDelete={() => setConfirmingId(null)}
            onConfirmDelete={confirmDelete}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.emptyState, { backgroundColor: theme.between }]}>
            <Ionicons name="time-outline" size={26} color={theme.text.muted} />
            <Text style={[styles.emptyText, { color: theme.text.muted }]}>
              {i18nText("autoI18n.izleme_kaydi_yok", "Henüz izleme kaydı yok")}
            </Text>
          </View>
        }
      />
    </BottomSheetModal>
  );
}

function SummaryCard({ icon, value, label, color, compact = false }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.summaryCard, { backgroundColor: theme.between, borderColor: theme.border }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.summaryValue, compact && styles.summaryValueCompact, { color: theme.text.primary }]}
      >
        {value}
      </Text>
      <Text allowFontScaling={false} style={[styles.summaryLabel, { color: theme.text.muted }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: "88%", borderTopLeftRadius: 30, borderTopRightRadius: 30, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 17, paddingTop: 10, shadowColor: "#000000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.32, shadowRadius: 26, elevation: 26 },
  handle: { width: 40, height: 4, borderRadius: 3, alignSelf: "center", marginBottom: 15 },
  header: { flexDirection: "row", alignItems: "center", gap: 11 },
  headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: "900", letterSpacing: -0.35 },
  subtitle: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  closeButton: { width: 35, height: 35, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", gap: 8, marginTop: 15 },
  summaryCard: { flex: 1, minHeight: 70, borderRadius: 15, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9, justifyContent: "center" },
  summaryValue: { fontSize: 16, lineHeight: 20, fontWeight: "900", marginTop: 3 },
  summaryValueCompact: { fontSize: 13 },
  summaryLabel: { fontSize: 9.5, fontWeight: "700", marginTop: 1 },
  againWrap: { marginTop: 11, borderRadius: 17, overflow: "hidden" },
  againButton: { minHeight: 56, borderRadius: 17, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  againIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  againCopy: { flex: 1 },
  againText: { color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" },
  againSubtitle: { color: "rgba(255,255,255,0.76)", fontSize: 10, fontWeight: "600", marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 17, marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.15 },
  countPill: { minWidth: 25, height: 20, paddingHorizontal: 7, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: 10.5, fontWeight: "900" },
  list: { flexGrow: 0 },
  listContent: { gap: 9, paddingBottom: 4 },
  eventCard: { borderRadius: 17, borderWidth: 1, overflow: "hidden" },
  eventMainRow: { minHeight: 68, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 9 },
  scopeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  eventCopy: { flex: 1, minWidth: 0 },
  eventDate: { fontSize: 13.5, fontWeight: "800" },
  eventMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  scopePill: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  scopePillText: { fontSize: 9, lineHeight: 11, fontWeight: "900" },
  eventDetails: { flex: 1, fontSize: 9.5, fontWeight: "600" },
  orderBadge: { minWidth: 32, height: 25, paddingHorizontal: 5, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  orderText: { fontSize: 9.5, fontWeight: "800" },
  deleteIconButton: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  confirmStrip: { borderTopWidth: 1, padding: 10, gap: 9 },
  confirmCopy: { flexDirection: "row", alignItems: "center", gap: 7 },
  confirmMessage: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  confirmButton: { minHeight: 36, paddingHorizontal: 13, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  destructiveButton: { backgroundColor: "#E11D48" },
  cancelText: { fontSize: 11.5, fontWeight: "800" },
  destructiveText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "900" },
  emptyState: { minHeight: 100, borderRadius: 17, alignItems: "center", justifyContent: "center", gap: 7 },
  emptyText: { fontSize: 12, fontWeight: "700" },
});
