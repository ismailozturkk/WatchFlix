/**
 * NotesCard — ProfileScreen içindeki "Notlar" özet widget'ı.
 *
 * MyActivityButton / RemindersPreviewButton ile aynı görsel dil: degrade zemin,
 * degrade simge kutusu, sağda "aç" butonu. Profilde yalnızca özet gösterilir:
 * öne çıkan not (sabitlenen, yoksa en yeni), sayılar ve yapılacakların
 * tamamlanma oranı. Karta dokununca tüm yönetimin olduğu NotesScreen açılır;
 * BASILI TUTUNCA "Yeni not / Yeni liste" hızlı ekleme sayfası açılır ve seçilen
 * tipin editörü profilden çıkmadan burada açılır (kayıt NotesScreen ile aynı
 * `saveNote` yolundan geçer).
 * Veri `useProfileNotes()` (Firestore) üzerinden okunur.
 *
 * YÜKSEKLİK: dolu, boş ve yükleniyor halleri AYNI gövde yüksekliğini tutar
 * (FEATURED_H + gap + CELL_H); yoksa veri gelince sayfa zıplar.
 */
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import Skeleton from "@components/Skeleton";
import { toast } from "@components/AppToast";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useProfileNotes } from "../../../context/ProfileNotesContext";
import { useDeviceNotifications } from "../../../context/DeviceNotificationsContext";
import * as Haptics from "../../../services/hapticsService";
import { alpha } from "../../../theme/colors";
import { i18nCount, i18nText } from "../../../utils/i18nText";
import { PRIME_HANDOFF_MS } from "../../../utils/notificationPriming";
import { buildNoteColorPairs, sortNotes, todoStats } from "../../../utils/notesView";
import { formatNoteDate } from "./notes/NoteCards";
import NoteEditorSheet from "./notes/NoteEditorSheet";
import NotesQuickAddSheet from "./notes/NotesQuickAddSheet";

const FEATURED_H = 56;
const CELL_H = 46;
const BODY_GAP = 8;

// ─── Basış animasyonu ────────────────────────────────────────────────────────
const usePressScale = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (toValue) =>
    Animated.spring(scale, {
      toValue,
      friction: 6,
      tension: 160,
      useNativeDriver: true,
    }).start();
  return { scale, onPressIn: () => to(0.98), onPressOut: () => to(1) };
};

// ─── Öne çıkan not ───────────────────────────────────────────────────────────
// Notun KENDİ rengiyle boyanır (NoteCards ile aynı kural): sol şerit + hafif zemin.
const FeaturedNote = memo(function FeaturedNote({ note, theme, language }) {
  const isTodo = note.type === "todo";
  const color = note.color || theme.accent;
  const stats = todoStats(note);

  const title =
    note.title ||
    (isTodo
      ? i18nText("autoI18n.basliksiz_liste", "Başlıksız Liste")
      : i18nText("autoI18n.basliksiz_not", "Başlıksız Not"));

  // İkinci satır: notta ilk dolu satır, listede sıradaki bekleyen madde.
  // Hepsi bitmişse kart boş kalmasın diye ilk madde çizili gösterilir.
  let line;
  let lineDone = false;
  if (isTodo) {
    const todos = Array.isArray(note.todos) ? note.todos : [];
    const next = todos.find((todo) => !todo.done) || todos[0];
    line = next?.text;
    lineDone = !!next?.done;
  } else {
    line = String(note.content || "")
      .split(/\r?\n/)
      .map((part) => part.trim())
      .find(Boolean);
  }
  if (!line) line = i18nText("autoI18n.icerik_yok", "İçerik yok");

  return (
    <View
      style={[
        styles.featured,
        { backgroundColor: alpha(color, 0.12), borderColor: alpha(color, 0.28) },
      ]}
    >
      <View style={[styles.featuredBar, { backgroundColor: color }]} />
      <View style={styles.featuredBody}>
        <View style={styles.featuredRow}>
          {note.pinned ? <Ionicons name="pin" size={12} color={color} /> : null}
          <Text
            allowFontScaling={false}
            fontRole="body"
            numberOfLines={1}
            style={[styles.featuredTitle, { color: theme.text.primary }]}
          >
            {title}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.featuredDate, { color: theme.text.muted }]}
          >
            {formatNoteDate(note.updatedAt || note.createdAt, language)}
          </Text>
        </View>
        <View style={styles.featuredRow}>
          <Text
            allowFontScaling={false}
            fontRole="body"
            numberOfLines={1}
            style={[
              styles.featuredLine,
              {
                color: lineDone ? theme.text.muted : theme.text.secondary,
                textDecorationLine: lineDone ? "line-through" : "none",
              },
            ]}
          >
            {line}
          </Text>
          {isTodo && stats.total > 0 ? (
            <View style={styles.featuredProgress}>
              <View style={[styles.miniTrack, { backgroundColor: alpha(color, 0.2) }]}>
                <View
                  style={[
                    styles.miniFill,
                    { backgroundColor: color, width: `${stats.progress * 100}%` },
                  ]}
                />
              </View>
              <Text
                allowFontScaling={false}
                style={[styles.featuredCount, { color }]}
              >
                {stats.done}/{stats.total}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
});

// ─── Sayı hücresi ────────────────────────────────────────────────────────────
// `progress` (0..1) verilirse hücrenin alt kenarında ince bir ilerleme çizgisi çizer.
const StatCell = memo(function StatCell({
  icon,
  color,
  value,
  label,
  theme,
  flex = 1,
  progress,
}) {
  return (
    <View
      style={[
        styles.cell,
        {
          flex,
          backgroundColor: alpha(color, 0.1),
          borderColor: alpha(color, 0.22),
        },
      ]}
    >
      <View style={[styles.cellIcon, { backgroundColor: alpha(color, 0.18) }]}>
        <Ionicons name={icon} size={13} color={color} />
      </View>
      <View style={styles.cellText}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.cellValue, { color: theme.text.primary }]}
        >
          {value}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.cellLabel, { color: theme.text.muted }]}
        >
          {label}
        </Text>
      </View>
      {progress != null ? (
        <View style={[styles.cellTrack, { backgroundColor: alpha(color, 0.18) }]}>
          <View
            style={[
              styles.cellFill,
              { backgroundColor: color, width: `${progress * 100}%` },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
});

export default function NotesCard({ navigation }) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const { notes, loadingNotes, saveNote, canCreateNote, checkCanCreateNote } = useProfileNotes();
  const { primeNotificationPermission } = useDeviceNotifications();
  const { scale, onPressIn, onPressOut } = usePressScale();

  // ── Hızlı ekleme (basılı tut) ───────────────────────────────────────────────
  // İki sayfa da İLK kullanımda bağlanır: profil her açılışta çizilir, çoğu
  // oturumda kimse uzun basmaz — editörün state'leri ve etkileri boşuna kurulmasın.
  const [sheetsReady, setSheetsReady] = useState(false);
  const [quickVisible, setQuickVisible] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorType, setEditorType] = useState("note");
  // Seçilen tip, hızlı ekleme sayfası KAPANIP native penceresi kalkana kadar
  // bekler: iOS kapanmakta olan Modal'ın üstüne ikincisini sunamaz.
  const pendingTypeRef = useRef(null);
  const colorPairs = useMemo(() => buildNoteColorPairs(theme.notesColor), [theme.notesColor]);

  const title = t.profileScreen?.Notes?.notes ?? i18nText("autoI18n.notlar", "Notlar");

  // ── İstatistikler ───────────────────────────────────────────────────────────
  const {
    noteCount,
    todoCount,
    totalTodos,
    pendingTodos,
    progressPct,
    featured,
  } = useMemo(() => {
    const list = notes || [];
    const todoLists = list.filter((n) => n.type === "todo");

    let total = 0;
    let done = 0;
    todoLists.forEach((n) => {
      const s = todoStats(n);
      total += s.total;
      done += s.done;
    });

    return {
      noteCount: list.length - todoLists.length,
      todoCount: todoLists.length,
      totalTodos: total,
      pendingTodos: total - done,
      progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
      // Sabitlenenler önde, sonra en yeni (NotesScreen ile aynı sıralama).
      featured: sortNotes(list)[0] || null,
    };
  }, [notes]);

  const ready = !loadingNotes;
  const isEmpty = (notes || []).length === 0;
  const accent = theme.accent;
  const green = theme.colors?.green ?? "#4ade80";
  const orange = theme.colors?.orange ?? "#FF7C25";
  // Simge kutusunun ikinci rengi: not defterine yakışan sıcak ton.
  const warm = theme.notesColor?.yellow ?? orange;

  const goToNotes = () => navigation?.navigate("NotesScreen");

  const openQuickAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Modal açılınca parmak kalkışı karta ulaşmayabilir; kart basılı kalmasın.
    onPressOut();
    pendingTypeRef.current = null;
    setSheetsReady(true);
    setQuickVisible(true);
  };
  const chooseQuickType = useCallback((type) => {
    pendingTypeRef.current = type;
    setQuickVisible(false);
  }, []);
  const openEditor = useCallback((type) => {
    // Ücretsiz planda 5 not / 5 yapılacak: dolu tipte editör açılmaz, yükseltme
    // sayfası gelir. Buraya hızlı ekleme sayfası KAPANDIKTAN sonra gelinir
    // (onQuickDismissed), yani üst üste Modal yok.
    if (!checkCanCreateNote(type)) return;
    setEditorType(type);
    setSheetsReady(true);
    setEditorVisible(true);
  }, [checkCanCreateNote]);

  // Editörde diğer tip dolu ve ona basıldı: editörü kapat, pencere kalkınca uyar.
  const pendingFullTypeRef = useRef(null);
  const fullTypes = ["note", "todo"].filter((tp) => !canCreateNote(tp));
  const handleFullTypePress = useCallback((type) => {
    pendingFullTypeRef.current = type;
    setEditorVisible(false);
  }, []);
  const handleEditorDismissed = useCallback(() => {
    const type = pendingFullTypeRef.current;
    pendingFullTypeRef.current = null;
    if (type) checkCanCreateNote(type);
  }, [checkCanCreateNote]);
  const onQuickDismissed = useCallback(() => {
    const type = pendingTypeRef.current;
    pendingTypeRef.current = null;
    if (type) openEditor(type);
  }, [openEditor]);

  const handleSave = useCallback(
    async (note) => {
      const saved = await saveNote(note);
      if (saved === false) return false;
      setEditorVisible(false);
      toast.success(
        note?.type === "todo"
          ? i18nText("autoI18n.notes_liste_eklendi", "Liste eklendi")
          : i18nText("autoI18n.notes_not_eklendi", "Not eklendi"),
      );
      // Tarihli liste = hatırlatma; OS izni yoksa bildirim ASLA düşmez. İzin
      // sayfası da bir alt sayfa — editörün kapanışını bekler (NotesScreen ile aynı).
      if (note?.scheduledDate) {
        setTimeout(primeNotificationPermission, PRIME_HANDOFF_MS);
      }
      return true;
    },
    [saveNote, primeNotificationPermission],
  );

  const headerTitle =
    ready && !isEmpty
      ? i18nCount("autoI18n.notes_toplam", "{{n}} kayıt", noteCount + todoCount)
      : title;

  return (
    <View style={styles.section}>
      <Text
        allowFontScaling={false}
        style={[styles.sectionTitle, { color: theme.text.muted }]}
      >
        {title}
      </Text>

      <Animated.View
        style={[
          styles.cardShadow,
          { backgroundColor: theme.secondary, shadowColor: theme.shadow },
          { transform: [{ scale }] },
        ]}
      >
        <Pressable
          onPress={goToNotes}
          onLongPress={openQuickAdd}
          delayLongPress={350}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${headerTitle}`}
          accessibilityHint={i18nText(
            "autoI18n.notes_card_ac_ipucu",
            "Tüm notlarını ve yapılacaklarını açar. Yeni not veya liste eklemek için basılı tut",
          )}
          // Basılı tutma ekran okuyucuyla ulaşılamaz; aynı eylemler özel eylem olarak sunulur.
          accessibilityActions={[
            { name: "newNote", label: i18nText("autoI18n.notes_yeni_not", "Yeni not") },
            { name: "newTodo", label: i18nText("autoI18n.notes_yeni_liste", "Yeni liste") },
          ]}
          onAccessibilityAction={(event) => {
            const action = event.nativeEvent.actionName;
            if (action === "newNote") openEditor("note");
            else if (action === "newTodo") openEditor("todo");
          }}
          style={[styles.card, { borderColor: alpha(accent, 0.28) }]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={[alpha(accent, 0.2), alpha(warm, 0.07), "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* ── Başlık satırı ── */}
          <View style={styles.headerRow}>
            <LinearGradient
              colors={[accent, warm]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconWrap}
            >
              <Ionicons name="journal" size={19} color="#fff" />
            </LinearGradient>

            <View style={styles.headerText}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.title, { color: theme.text.primary }]}
              >
                {headerTitle}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.subtitle, { color: theme.text.muted }]}
              >
                {i18nText("autoI18n.notlar_ve_yapilacaklar", "Notlar ve yapılacaklar")}
              </Text>
            </View>

            {ready && pendingTodos > 0 && (
              <View
                style={[
                  styles.pendingBadge,
                  {
                    backgroundColor: alpha(orange, 0.14),
                    borderColor: alpha(orange, 0.32),
                  },
                ]}
              >
                <View style={[styles.pendingDot, { backgroundColor: orange }]} />
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.pendingBadgeText, { color: orange }]}
                >
                  {i18nText("autoI18n.bekliyor_count", "{{count}} bekliyor", {
                    count: pendingTodos,
                  })}
                </Text>
              </View>
            )}

            <View style={[styles.openButton, { backgroundColor: alpha(accent, 0.14) }]}>
              <Ionicons name="arrow-forward" size={16} color={accent} />
            </View>
          </View>

          {/* ── Gövde ── */}
          {!ready ? (
            <View style={styles.body}>
              <Skeleton width="100%" height={FEATURED_H} style={styles.skeleton} />
              <Skeleton width="100%" height={CELL_H} style={styles.skeleton} />
            </View>
          ) : isEmpty ? (
            <View
              style={[
                styles.emptyBox,
                {
                  borderColor: alpha(theme.text.muted, 0.3),
                  backgroundColor: alpha(theme.primary, 0.4),
                },
              ]}
            >
              <Ionicons name="document-text-outline" size={22} color={theme.text.muted} />
              <Text
                allowFontScaling={false}
                style={[styles.emptyText, { color: theme.text.muted }]}
              >
                {i18nText("autoI18n.henuz_not_eklenmedi", "Henüz not eklenmedi")}
              </Text>
              {/* Gerçek düğme: eskiden görsel bir kutuydu, dokunuş kartın kendisine
                  gidip yalnız Notlar ekranını açıyordu (T3 B11). */}
              <Pressable
                onPress={() => openEditor("note")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.notes_yeni_not", "Yeni not")}
                style={({ pressed }) => [
                  styles.emptyCta,
                  { backgroundColor: alpha(accent, pressed ? 0.24 : 0.14), borderColor: alpha(accent, 0.4) },
                ]}
              >
                <Ionicons name="add" size={14} color={accent} />
                <Text
                  allowFontScaling={false}
                  style={[styles.emptyCtaText, { color: accent }]}
                >
                  {i18nText("autoI18n.notes_yeni_not", "Yeni not")}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.body}>
              {featured ? (
                <FeaturedNote note={featured} theme={theme} language={language} />
              ) : null}

              <View style={styles.cellRow}>
                <StatCell
                  icon="document-text"
                  color={accent}
                  value={noteCount}
                  label={i18nText("autoI18n.not_lower", "not")}
                  theme={theme}
                />
                <StatCell
                  icon="checkbox"
                  color={theme.notesColor?.blue ?? accent}
                  value={todoCount}
                  label={i18nText("autoI18n.liste_lower", "liste")}
                  theme={theme}
                />
                {totalTodos > 0 && (
                  <StatCell
                    icon="checkmark-done"
                    color={green}
                    value={`%${progressPct}`}
                    label={i18nText("autoI18n.tamamlandi_lower", "tamamlandı")}
                    theme={theme}
                    flex={1.25}
                    progress={progressPct / 100}
                  />
                )}
              </View>
            </View>
          )}
        </Pressable>
      </Animated.View>

      {sheetsReady ? (
        <>
          <NotesQuickAddSheet
            visible={quickVisible}
            theme={theme}
            onClose={() => {
              pendingTypeRef.current = null;
              setQuickVisible(false);
            }}
            onSelect={chooseQuickType}
            onDismissed={onQuickDismissed}
          />
          <NoteEditorSheet
            visible={editorVisible}
            initialNote={null}
            defaultType={editorType}
            theme={theme}
            colorPairs={colorPairs}
            language={language}
            onSave={handleSave}
            fullTypes={fullTypes}
            onFullTypePress={handleFullTypePress}
            onDismissed={handleEditorDismissed}
            onClose={() => setEditorVisible(false)}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: "100%", marginBottom: 14 },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 20,
    textTransform: "uppercase",
  },

  // Gölge ayrı katmanda: `overflow: hidden` bir görünümün kendi gölgesini keser.
  cardShadow: {
    marginHorizontal: 16,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 12,
    overflow: "hidden",
  },

  // Header
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 15.5, fontWeight: "800", letterSpacing: -0.1 },
  subtitle: { fontSize: 10.5, fontWeight: "600", marginTop: 1 },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pendingDot: { width: 6, height: 6, borderRadius: 3 },
  pendingBadgeText: { fontSize: 10.5, fontWeight: "800" },
  openButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  // Gövde
  body: { marginTop: 12, gap: BODY_GAP },
  skeleton: { borderRadius: 14 },

  // Öne çıkan not
  featured: {
    height: FEATURED_H,
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  featuredBar: { width: 4 },
  featuredBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 11,
  },
  featuredRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  featuredTitle: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: "800", letterSpacing: -0.2 },
  featuredDate: { fontSize: 10.5, fontWeight: "700" },
  featuredLine: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  featuredProgress: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniTrack: { width: 34, height: 4, borderRadius: 2, overflow: "hidden" },
  miniFill: { height: 4, borderRadius: 2 },
  featuredCount: { fontSize: 10.5, fontWeight: "900" },

  // Sayı hücreleri
  cellRow: { flexDirection: "row", gap: 6 },
  cell: {
    height: CELL_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  cellIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  cellText: { flexShrink: 1, minWidth: 0 },
  cellValue: { fontSize: 15, lineHeight: 18, fontWeight: "900", letterSpacing: -0.3 },
  cellLabel: { fontSize: 10, lineHeight: 12, fontWeight: "700" },
  cellTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3 },
  cellFill: { height: 3 },

  // Boş durum — gövde yüksekliğini dolu hâlle eşit tutar.
  emptyBox: {
    marginTop: 12,
    minHeight: FEATURED_H + BODY_GAP + CELL_H,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingVertical: 10,
  },
  emptyText: { fontSize: 12.5, fontWeight: "600" },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
    paddingLeft: 8,
    paddingRight: 11,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
  },
  emptyCtaText: { fontSize: 11.5, fontWeight: "800" },
});
