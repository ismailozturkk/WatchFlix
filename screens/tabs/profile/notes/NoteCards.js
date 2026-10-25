// screens/tabs/profile/notes/NoteCards.js
//
// Notlar ekranının kart bileşenleri: düz not / yapılacak kartı (liste ve ızgara
// düzeni), film-dizi notu kartı, boş durum ve yükleme iskeleti. Saf sunum —
// veri ve kalıcılık NotesScreen'de, hesaplar utils/notesView.js'te.
//
// Görsel dil: kart notun KENDİ rengiyle boyanır (kayıtlı `backgroundColor` zemin
// tonu + üst renk şeridi + renkli rozetler); sabitlenen kartın çerçevesi daha
// belirgin. Yapılacak kartındaki daireye dokunmak maddeyi kartı açmadan
// tamamlar.

import { intlLocaleOf } from "../../../../utils/appLanguages";
import React, { memo } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import Skeleton from "@components/Skeleton";
import { i18nText } from "../../../../utils/i18nText";
import { dueStatus, parseISODate, todoStats } from "../../../../utils/notesView";
import { alpha } from "../../../../theme/colors";
import usePosterUri from "../../../../hooks/usePosterUri";

const HIT = { top: 8, bottom: 8, left: 8, right: 8 };

const localeOf = (language) => (intlLocaleOf(language));

/** Bugün / Dün / "2 Eki" / "2 Eki 2025" — son düzenleme tarihi için kısa metin. */
export function formatNoteDate(timestamp, language, now = new Date()) {
  const ms = Number(timestamp);
  if (!ms) return "";
  const date = new Date(ms);
  if (isNaN(date.getTime())) return "";
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86400000);
  if (diffDays === 0) return i18nText("autoI18n.bugun", "Bugün");
  if (diffDays === 1) return i18nText("autoI18n.dun", "Dün");
  return date.toLocaleDateString(localeOf(language), {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Hatırlatıcı günü için rozet metni + rengi. Bitmiş listede gecikme gösterilmez. */
function dueBadge(note, theme, language, complete) {
  if (!note.scheduledDate) return null;
  const status = dueStatus(note.scheduledDate);
  if (!status) return null;
  const color = note.color || theme.accent;
  const dateText = (parseISODate(note.scheduledDate) || new Date()).toLocaleDateString(
    localeOf(language),
    { day: "numeric", month: "short" },
  );

  if (!complete && status.state === "overdue") {
    return {
      color: theme.colors?.red || "#EF4444",
      icon: "alert-circle",
      text: `${i18nText("autoI18n.notes_gecikti", "Gecikti")} · ${dateText}`,
    };
  }
  if (!complete && status.state === "today") {
    return {
      color: theme.colors?.orange || "#F97316",
      icon: "time",
      text: i18nText("autoI18n.bugun", "Bugün"),
    };
  }
  if (status.state === "tomorrow") {
    return { color, icon: "calendar", text: i18nText("autoI18n.notes_yarin", "Yarın") };
  }
  return { color: complete ? theme.text.muted : color, icon: "calendar-outline", text: dateText };
}

// ─── Not / Yapılacak kartı ────────────────────────────────────────────────────
export const NoteCard = memo(function NoteCard({
  note,
  theme,
  language,
  layout,
  width,
  onPress,
  onCopy,
  onDelete,
  onTogglePin,
  onToggleTodo,
}) {
  const isGrid = layout === "grid";
  const isTodo = note.type === "todo";
  const color = note.color || theme.accent;
  const todos = note.todos || [];
  const stats = todoStats(note);
  const badge = dueBadge(note, theme, language, stats.complete);

  // Hepsi bitmişse kart boş kalmasın: biten maddeler çizili gösterilir.
  const activeTodos = todos.filter((t) => !t.done);
  const preview = (activeTodos.length > 0 ? activeTodos : todos).slice(0, isGrid ? 4 : 3);
  const hiddenCount = (activeTodos.length > 0 ? activeTodos : todos).length - preview.length;

  const title =
    note.title ||
    (isTodo
      ? i18nText("autoI18n.basliksiz_liste", "Başlıksız Liste")
      : i18nText("autoI18n.basliksiz_not", "Başlıksız Not"));

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(note)}
      accessibilityRole="button"
      style={[
        st.card,
        isGrid && { width },
        {
          backgroundColor: theme.secondary,
          borderColor: alpha(color, note.pinned ? 0.7 : 0.3),
          borderWidth: note.pinned ? 1.5 : 1,
        },
      ]}
    >
      {/* Notun kendi zemin tonu */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: note.backgroundColor || alpha(color, 0.12) }]}
      />
      <View style={[st.topBar, { backgroundColor: color }]} />

      <View style={st.body}>
        {/* Rozetler + sabitle */}
        <View style={st.headRow}>
          <View style={[st.typeChip, { backgroundColor: alpha(color, 0.18) }]}>
            <Ionicons name={isTodo ? "checkbox" : "document-text"} size={11} color={color} />
            {!isGrid && (
              <Text allowFontScaling={false} style={[st.typeChipText, { color }]}>
                {isTodo ? i18nText("autoI18n.yapilacak", "Yapılacak") : i18nText("autoI18n.not", "Not")}
              </Text>
            )}
          </View>
          {badge && !isGrid ? (
            <View style={[st.dueChip, { backgroundColor: alpha(badge.color, 0.16) }]}>
              <Ionicons name={badge.icon} size={11} color={badge.color} />
              <Text allowFontScaling={false} style={[st.dueText, { color: badge.color }]} numberOfLines={1}>
                {badge.text}
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => onTogglePin?.(note)}
            hitSlop={HIT}
            accessibilityRole="button"
            accessibilityLabel={
              note.pinned
                ? i18nText("autoI18n.notes_sabitlemeyi_kaldir", "Sabitlemeyi kaldır")
                : i18nText("autoI18n.notes_sabitle", "Sabitle")
            }
          >
            <Ionicons
              name={note.pinned ? "pin" : "pin-outline"}
              size={17}
              color={note.pinned ? color : theme.text.muted}
            />
          </TouchableOpacity>
        </View>

        {badge && isGrid ? (
          <View style={[st.dueChip, st.dueChipGrid, { backgroundColor: alpha(badge.color, 0.16) }]}>
            <Ionicons name={badge.icon} size={11} color={badge.color} />
            <Text allowFontScaling={false} style={[st.dueText, { color: badge.color }]} numberOfLines={1}>
              {badge.text}
            </Text>
          </View>
        ) : null}

        <Text
          allowFontScaling={false}
          // Kullanıcının yazdığı not başlığı: "başlık" kelimesini taşısa da
          // içerik kullanıcı metnidir, başlık fontuna girmemeli.
          fontRole="body"
          style={[st.title, { color: theme.text.primary }]}
          numberOfLines={2}
        >
          {title}
        </Text>

        {!isTodo ? (
          <Text
            allowFontScaling={false}
            fontRole="body"
            style={[st.content, { color: theme.text.secondary }]}
            numberOfLines={isGrid ? 7 : 3}
          >
            {note.content || i18nText("autoI18n.icerik_yok", "İçerik yok")}
          </Text>
        ) : (
          <View style={st.todoList}>
            {preview.map((todo) => (
              <View key={todo.id} style={st.todoRow}>
                <TouchableOpacity
                  onPress={() => onToggleTodo?.(note.id, todo.id)}
                  hitSlop={HIT}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!todo.done }}
                >
                  <Ionicons
                    name={todo.done ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={todo.done ? color : alpha(color, 0.85)}
                  />
                </TouchableOpacity>
                <Text
                  allowFontScaling={false}
                  fontRole="body"
                  style={[
                    st.todoText,
                    {
                      color: todo.done ? theme.text.muted : theme.text.secondary,
                      textDecorationLine: todo.done ? "line-through" : "none",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {todo.text}
                </Text>
              </View>
            ))}
            {hiddenCount > 0 && (
              <Text allowFontScaling={false} style={[st.moreText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.n_yapilacak_daha", "+{{count}} yapılacak daha…", { count: hiddenCount })}
              </Text>
            )}
            {stats.total > 0 && (
              <View style={st.progressRow}>
                <View style={[st.progressTrack, { backgroundColor: alpha(color, 0.18) }]}>
                  <View
                    style={[st.progressFill, { backgroundColor: color, width: `${stats.progress * 100}%` }]}
                  />
                </View>
                <Text allowFontScaling={false} style={[st.progressText, { color }]}>
                  {stats.done}/{stats.total}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Alt satır: tarih + hızlı aksiyonlar */}
        <View style={st.footer}>
          <Ionicons name="time-outline" size={11} color={theme.text.muted} />
          <Text allowFontScaling={false} style={[st.date, { color: theme.text.muted }]} numberOfLines={1}>
            {formatNoteDate(note.updatedAt || note.createdAt, language)}
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => onCopy?.(note)}
            hitSlop={HIT}
            style={[st.actionBtn, { backgroundColor: alpha(theme.text.primary, 0.07) }]}
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.notes_kopyala", "Kopyala")}
          >
            <Ionicons name="copy-outline" size={14} color={theme.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete?.(note)}
            hitSlop={HIT}
            style={[st.actionBtn, { backgroundColor: "rgba(239,68,68,0.12)" }]}
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.sil", "Sil")}
          >
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Film / Dizi notu kartı ──────────────────────────────────────────────────
// Düz nottan farklı şema (`text`, `posterPath`, `mediaId`, `type`) taşıdığı için
// ayrı kart: poster + tür rozeti + "detaya git" ve sil. Düzenleme, detay
// sayfalarındaki "Notum" kartıyla AYNI MediaNoteSheet'i açar.
export const MediaNoteCard = memo(function MediaNoteCard({
  note,
  theme,
  language,
  onPress,
  onGoTo,
  onDelete,
}) {
  const isTv = note.type === "tv";
  const accent = theme.accent;
  const posterUri = usePosterUri();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(note)}
      accessibilityRole="button"
      style={[st.mediaCard, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <LinearGradient
        colors={[alpha(accent, 0.12), alpha(accent, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {note.posterPath ? (
        <Image source={{ uri: posterUri(note.type, note.mediaId, note.posterPath) }} style={st.mediaPoster} />
      ) : (
        <View style={[st.mediaPoster, st.mediaPosterFallback, { backgroundColor: theme.between }]}>
          <Ionicons name={isTv ? "tv-outline" : "film-outline"} size={22} color={theme.text.muted} />
        </View>
      )}

      <View style={st.mediaBody}>
        <View style={st.headRow}>
          <View style={[st.typeChip, { backgroundColor: alpha(accent, 0.16) }]}>
            <Ionicons name={isTv ? "tv" : "film"} size={11} color={accent} />
            <Text allowFontScaling={false} style={[st.typeChipText, { color: accent }]}>
              {isTv ? i18nText("autoI18n.dizi", "Dizi") : i18nText("autoI18n.film", "Film")}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => onGoTo?.(note)}
            hitSlop={HIT}
            style={[st.actionBtn, { backgroundColor: alpha(accent, 0.14) }]}
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.notes_detaya_git", "Detaya git")}
          >
            <Ionicons name="arrow-redo-outline" size={14} color={accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete?.(note)}
            hitSlop={HIT}
            style={[st.actionBtn, { backgroundColor: "rgba(239,68,68,0.12)" }]}
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.sil", "Sil")}
          >
            <Ionicons name="trash-outline" size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <Text allowFontScaling={false} fontRole="body" style={[st.title, { color: theme.text.primary }]} numberOfLines={2}>
          {note.title || i18nText("autoI18n.basliksiz_yapim", "Başlıksız Yapım")}
        </Text>

        <View
          style={[
            st.mediaQuote,
            { backgroundColor: alpha(theme.text.primary, 0.05), borderLeftColor: accent },
          ]}
        >
          <Text
            allowFontScaling={false}
            fontRole="body"
            style={[st.content, { color: theme.text.secondary, marginBottom: 0 }]}
            numberOfLines={3}
          >
            {note.text || i18nText("autoI18n.icerik_yok", "İçerik yok")}
          </Text>
        </View>

        <View style={st.footer}>
          <Ionicons name="time-outline" size={11} color={theme.text.muted} />
          <Text allowFontScaling={false} style={[st.date, { color: theme.text.muted }]}>
            {formatNoteDate(note.updatedAt || note.createdAt, language)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Boş durum ───────────────────────────────────────────────────────────────
const EMPTY_META = {
  note: {
    icon: "document-text-outline",
    title: () => i18nText("autoI18n.henuz_not_yok", "Henüz not yok"),
    hint: () => i18nText("autoI18n.yeni_not_ekle_ipucu", "Sağ alttaki + butonuyla yeni bir not ekle"),
    cta: () => i18nText("autoI18n.notes_yeni_not", "Yeni not"),
  },
  todo: {
    icon: "checkbox-outline",
    title: () => i18nText("autoI18n.henuz_yapilacak_yok", "Henüz yapılacak yok"),
    hint: () => i18nText("autoI18n.yeni_yapilacak_ekle_ipucu", "Sağ alttaki + butonuyla yeni bir yapılacak listesi ekle"),
    cta: () => i18nText("autoI18n.notes_yeni_liste", "Yeni liste"),
  },
  media: {
    icon: "film-outline",
    title: () => i18nText("autoI18n.henuz_film_dizi_notu_yok", "Henüz film/dizi notu yok"),
    hint: () =>
      i18nText(
        "autoI18n.film_dizi_notu_ipucu",
        "Bir film veya dizinin detay sayfasındaki \"Notum\" kartından not ekleyebilirsin",
      ),
    cta: null,
  },
};

export const NotesEmptyState = memo(function NotesEmptyState({ tab, theme, searching, onCreate }) {
  const meta = EMPTY_META[tab] || EMPTY_META.note;
  const accent = theme.accent;
  const icon = searching ? "search-outline" : meta.icon;
  const title = searching
    ? i18nText("autoI18n.sonuc_bulunamadi", "Sonuç bulunamadı")
    : meta.title();
  const hint = searching ? i18nText("autoI18n.notes_arama_ipucu", "Farklı bir kelime dene") : meta.hint();
  const cta = !searching && meta.cta && onCreate ? meta.cta() : null;

  return (
    <View style={st.empty}>
      <View style={[st.emptyHalo, { backgroundColor: alpha(accent, 0.1), borderColor: alpha(accent, 0.22) }]}>
        <View style={[st.emptyIcon, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <Ionicons name={icon} size={36} color={accent} />
        </View>
      </View>
      <Text allowFontScaling={false} style={[st.emptyTitle, { color: theme.text.primary }]}>
        {title}
      </Text>
      <Text allowFontScaling={false} style={[st.emptyHint, { color: theme.text.muted }]}>
        {hint}
      </Text>
      {cta ? (
        <TouchableOpacity
          onPress={onCreate}
          activeOpacity={0.85}
          style={[st.emptyCta, { backgroundColor: alpha(accent, 0.14), borderColor: alpha(accent, 0.4) }]}
        >
          <Ionicons name="add" size={18} color={accent} />
          <Text allowFontScaling={false} style={[st.emptyCtaText, { color: accent }]}>
            {cta}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

// ─── Yükleme iskeleti ────────────────────────────────────────────────────────
export const NotesSkeleton = memo(function NotesSkeleton({ theme, layout, width, count = 4 }) {
  const isGrid = layout === "grid";
  return (
    <View style={[st.skelWrap, isGrid && st.skelWrapGrid]}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            st.card,
            isGrid && { width },
            { backgroundColor: theme.secondary, borderColor: theme.border, padding: 14, gap: 10 },
          ]}
        >
          <Skeleton width={56} height={18} style={{ borderRadius: 9 }} />
          <Skeleton width={"70%"} height={16} style={{ borderRadius: 5 }} />
          <Skeleton width={"100%"} height={11} style={{ borderRadius: 4 }} />
          <Skeleton width={"85%"} height={11} style={{ borderRadius: 4 }} />
        </View>
      ))}
    </View>
  );
});

const st = StyleSheet.create({
  card: { borderRadius: 22, overflow: "hidden" },
  topBar: { height: 4 },
  body: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeChipText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  dueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 1,
  },
  dueChipGrid: { alignSelf: "flex-start", marginBottom: 8 },
  dueText: { fontSize: 10, fontWeight: "800", flexShrink: 1 },
  title: { fontSize: 16, lineHeight: 21, fontWeight: "800", letterSpacing: -0.2, marginBottom: 6 },
  content: { fontSize: 13.5, lineHeight: 20, marginBottom: 8 },

  todoList: { gap: 6, marginBottom: 6 },
  todoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  todoText: { flex: 1, fontSize: 13.5 },
  moreText: { fontSize: 11, fontWeight: "600", marginLeft: 26 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  progressTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 3 },
  progressText: { fontSize: 11, fontWeight: "900" },

  footer: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  date: { fontSize: 10.5, fontWeight: "600", flexShrink: 1 },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },

  mediaCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    overflow: "hidden",
    padding: 12,
    gap: 12,
  },
  mediaPoster: { width: 62, height: 92, borderRadius: 12 },
  mediaPosterFallback: { alignItems: "center", justifyContent: "center" },
  mediaBody: { flex: 1, minWidth: 0 },
  mediaQuote: {
    borderLeftWidth: 3,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },

  empty: { alignItems: "center", marginTop: 56, paddingHorizontal: 36 },
  emptyHalo: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", marginBottom: 6 },
  emptyHint: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
  },
  emptyCtaText: { fontSize: 14, fontWeight: "800" },

  skelWrap: { gap: 12 },
  skelWrapGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
