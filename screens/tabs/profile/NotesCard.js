/**
 * NotesCard — ProfileScreen içindeki "Notlar" özet widget'ı.
 *
 * RemindersPreviewButton ile aynı desen: profil ekranında yalnızca özet
 * (istatistik + son öğeler) gösterir, dokununca tüm not yönetimini içeren
 * NotesScreen'e gider. Veri `useProfileNotes()` (Firestore) üzerinden okunur.
 */
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useProfileNotes } from "../../../context/ProfileNotesContext";
import { i18nText } from "../../../utils/i18nText";

export default function NotesCard({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { notes, loadingNotes } = useProfileNotes();

  const title = t.profileScreen?.Notes?.notes ?? i18nText("autoI18n.notlar", "Notlar");

  // ── İstatistikler ───────────────────────────────────────────────────────────
  const {
    noteCount,
    todoCount,
    pendingTodos,
    progressPct,
    totalTodos,
  } = useMemo(() => {
    const list = notes || [];
    const noteItems = list.filter((n) => n.type !== "todo");
    const todoLists = list.filter((n) => n.type === "todo");

    const total = todoLists.reduce((acc, n) => acc + (n.todos?.length || 0), 0);
    const done = todoLists.reduce(
      (acc, n) => acc + (n.todos || []).filter((todo) => todo.done).length,
      0,
    );

    return {
      noteCount: noteItems.length,
      todoCount: todoLists.length,
      totalTodos: total,
      pendingTodos: total - done,
      progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [notes]);

  const isEmpty = (notes || []).length === 0;
  const accent = theme.accent;
  const green = theme.colors?.green ?? "#4ade80";
  const orange = theme.colors?.orange ?? "#FF7C25";

  const goToNotes = () => navigation?.navigate("NotesScreen");

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={goToNotes}
        activeOpacity={0.85}
        style={[
          styles.card,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        {/* ── Başlık satırı ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconWrap, { backgroundColor: accent + "22" }]}>
              <Ionicons name="journal" size={20} color={accent} />
            </View>
            <View>
              <Text
                allowFontScaling={false}
                style={[styles.title, { color: theme.text.primary }]}
              >
                {title}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.subtitle, { color: theme.text.muted }]}
              >
                {i18nText("autoI18n.notlar_ve_yapilacaklar", "Notlar ve yapılacaklar")}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {pendingTodos > 0 && (
              <View style={[styles.pendingBadge, { backgroundColor: orange + "22" }]}>
                <Text
                  allowFontScaling={false}
                  style={[styles.pendingBadgeText, { color: orange }]}
                >
                  {i18nText("autoI18n.bekliyor_count", "{{count}} bekliyor", { count: pendingTodos })}
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={accent} />
          </View>
        </View>

        {/* ── İçerik ── */}
        {loadingNotes ? null : isEmpty ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.primary }]}>
            <Ionicons name="pencil-outline" size={20} color={theme.text.muted} />
            <Text
              allowFontScaling={false}
              style={[styles.emptyText, { color: theme.text.muted }]}
            >
              {i18nText("autoI18n.henuz_not_eklenmedi", "Henüz not eklenmedi")}
            </Text>
          </View>
        ) : (
          // Stat çubuğu
          <View style={[styles.statRow, { backgroundColor: theme.primary }]}>
            <View style={styles.statItem}>
              <Ionicons name="document-text" size={14} color={accent} />
              <Text
                allowFontScaling={false}
                style={[styles.statValue, { color: theme.text.primary }]}
              >
                {noteCount}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statLabel, { color: theme.text.muted }]}
              >
                {i18nText("autoI18n.not_lower", "not")}
              </Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

            <View style={styles.statItem}>
              <Ionicons name="checkbox" size={14} color={green} />
              <Text
                allowFontScaling={false}
                style={[styles.statValue, { color: theme.text.primary }]}
              >
                {todoCount}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.statLabel, { color: theme.text.muted }]}
              >
                {i18nText("autoI18n.liste_lower", "liste")}
              </Text>
            </View>

            {totalTodos > 0 && (
              <>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={[styles.statItem, { flex: 2 }]}>
                  <View style={styles.progressArea}>
                    <View style={styles.progressLabelRow}>
                      <Text
                        allowFontScaling={false}
                        style={[styles.statLabel, { color: theme.text.muted }]}
                      >
                        {i18nText("autoI18n.tamamlandi_lower", "tamamlandı")}
                      </Text>
                      <Text
                        allowFontScaling={false}
                        style={[styles.progressPct, { color: green }]}
                      >
                        %{progressPct}
                      </Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { backgroundColor: green, width: `${progressPct}%` },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              </>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "100%", alignItems: "center", marginBottom: 14 },
  card: {
    width: "92%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 16, fontWeight: "800" },
  subtitle: { fontSize: 11, marginTop: 1 },

  pendingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pendingBadgeText: { fontSize: 10, fontWeight: "800" },

  // Boş state
  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyText: { fontSize: 13 },

  // Stat row
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  statItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 11 },
  statDivider: { width: 1, height: 20, marginHorizontal: 6 },

  // Progress
  progressArea: { flex: 1, gap: 4 },
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressPct: { fontSize: 11, fontWeight: "800" },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
});
