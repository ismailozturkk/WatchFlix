import React from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { i18nText } from "../../utils/i18nText";

const scopeLabel = (scope) => {
  if (scope === "show") return i18nText("autoI18n.tum_dizi", "Tüm dizi");
  if (scope === "season") return i18nText("autoI18n.sezon", "Sezon");
  if (scope === "episode") return i18nText("autoI18n.bolum", "Bölüm");
  if (scope === "movie") return i18nText("autoI18n.film", "Film");
  return i18nText("autoI18n.izleme_kaydi", "İzleme kaydı");
};

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
  const locale = language === "tr" ? "tr-TR" : "en-US";
  const formatDate = (value) => {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return String(value || "");
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
          <BlurView tint="dark" intensity={42} style={StyleSheet.absoluteFill} />
        </TouchableOpacity>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.secondary || theme.background,
              borderColor: `${theme.primary || "#8B5CF6"}42`,
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: `${theme.primary || "#8B5CF6"}1F` }]}>
              <MaterialCommunityIcons
                name="history"
                size={22}
                color={theme.primary || "#A78BFA"}
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: theme.text?.primary || theme.text }]} numberOfLines={1}>
                {title || i18nText("autoI18n.izleme_gecmisi", "İzleme geçmişi")}
              </Text>
              <Text style={[styles.subtitle, { color: theme.text?.secondary || "#A1A1AA" }]}>
                {i18nText(
                  "autoI18n.izleme_kaydi_aciklama",
                  "Tekrar izleyebilir veya kaldırılacak kaydı seçebilirsiniz.",
                )}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={10}>
              <Ionicons name="close" size={22} color={theme.text?.secondary || "#A1A1AA"} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            disabled={busy}
            onPress={onAddAgain}
            activeOpacity={0.86}
            style={styles.againWrap}
          >
            <LinearGradient
              colors={[theme.primary || "#7C3AED", theme.accent || "#EC4899"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.againButton}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.againText}>
                {i18nText("autoI18n.tekrar_izlendi_ekle", "Tekrar izlendi olarak ekle")}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { color: theme.text?.secondary || "#A1A1AA" }]}>
            {i18nText("autoI18n.kayitli_izlemeler", "Kayıtlı izlemeler")} · {events.length}
          </Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {events.map((event, index) => (
              <View
                key={event.id}
                style={[
                  styles.eventRow,
                  {
                    backgroundColor: `${theme.text?.primary || "#FFFFFF"}08`,
                    borderColor: `${theme.text?.primary || "#FFFFFF"}12`,
                  },
                ]}
              >
                <View style={[styles.number, { backgroundColor: `${theme.primary || "#8B5CF6"}20` }]}>
                  <Text style={[styles.numberText, { color: theme.primary || "#A78BFA" }]}>
                    {events.length - index}
                  </Text>
                </View>
                <View style={styles.eventCopy}>
                  <Text style={[styles.eventDate, { color: theme.text?.primary || theme.text }]}>
                    {formatDate(event.watchedAt)}
                  </Text>
                  <Text style={[styles.eventScope, { color: theme.text?.secondary || "#A1A1AA" }]}>
                    {scopeLabel(event.scope)}
                    {event.episodeCount > 1 ? ` · ${i18nText("autoI18n.n_bolum", "{{count}} bölüm", { count: event.episodeCount })}` : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => onDeleteEvent?.(event)}
                  style={styles.deleteButton}
                  hitSlop={6}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FB7185" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={18} color="#FB7185" />
                      <Text style={styles.deleteText}>
                        {i18nText("autoI18n.sil", "Sil")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "78%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 24,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 10,
    marginBottom: 15,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 11 },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  closeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  againWrap: { marginTop: 18, borderRadius: 17, overflow: "hidden" },
  againButton: {
    minHeight: 52,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  againText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  sectionLabel: { marginTop: 18, marginBottom: 9, fontSize: 12, fontWeight: "700" },
  list: { flexGrow: 0 },
  listContent: { gap: 8, paddingBottom: 4 },
  eventRow: {
    minHeight: 66,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
  },
  number: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  numberText: { fontSize: 13, fontWeight: "900" },
  eventCopy: { flex: 1, paddingHorizontal: 11 },
  eventDate: { fontSize: 14, fontWeight: "700" },
  eventScope: { marginTop: 3, fontSize: 11.5, fontWeight: "600" },
  deleteButton: {
    minWidth: 58,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: "rgba(251,113,133,0.1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  deleteText: { color: "#FB7185", fontSize: 12, fontWeight: "800" },
});
