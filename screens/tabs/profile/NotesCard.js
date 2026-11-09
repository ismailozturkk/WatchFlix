/**
 * NotesCard — ProfileScreen içindeki "Notlar" özet widget'ı.
 *
 * MyActivityButton / RemindersPreviewButton ile aynı görsel dil: degrade zemin,
 * degrade simge kutusu; sağda görünür "+" hızlı ekleme düğmesi + ok (9 Kas).
 * Sayılar tek parça bölücülü şeritte. Profilde yalnızca özet gösterilir:
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
import { openPremiumScreen } from "../../../services/premiumUpsell";
import { alpha, applyRelative } from "../../../theme/colors";
import { toHex } from "../../../utils/colorUtils";
import { i18nCount, i18nText, percentText } from "../../../utils/i18nText";
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
        { backgroundColor: alpha(color, 0.1), borderColor: alpha(color, 0.22) },
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(color, 0.16), "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.featuredIcon, { backgroundColor: alpha(color, 0.2) }]}>
        <Ionicons name={isTodo ? "checkbox" : "document-text"} size={16} color={color} />
      </View>
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

// ─── Sayı şeridi segmenti ────────────────────────────────────────────────────
// Tek parça şeridin bir dilimi: renkli nokta + etiket üstte, büyük sayı altta.
// `progress` (0..1) verilirse sayının yanında ince bir ilerleme çubuğu çizer.
const StatSegment = memo(function StatSegment({
  color,
  value,
  label,
  theme,
  flex = 1,
  progress,
}) {
  return (
    <View style={[styles.segment, { flex }]}>
      <View style={styles.segmentHead}>
        <View style={[styles.segmentDot, { backgroundColor: color }]} />
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.segmentLabel, { color: theme.text.muted }]}
        >
          {label}
        </Text>
      </View>
      <View style={styles.segmentValueRow}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.segmentValue, { color: theme.text.primary }]}
        >
          {value}
        </Text>
        {progress != null ? (
          <View style={[styles.segmentTrack, { backgroundColor: alpha(color, 0.2) }]}>
            <View
              style={[
                styles.segmentFill,
                { backgroundColor: color, width: `${progress * 100}%` },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
});

export default function NotesCard({ navigation }) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const {
    notes,
    loadingNotes,
    saveNote,
    canCreateNote,
    checkCanCreateNote,
    noteTextLimits,
    showNoteTextLimit,
    canSetNoteReminder,
    showNoteReminderUpsell,
  } = useProfileNotes();
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
  // Degradelerin ikinci rengi: accent'in KOMŞU tonu (renk çarkında hafif kaydırılmış,
  // biraz açık). Eskiden not sarısıydı; accent→sarı geçişi ortada çamurlu/kahverengi
  // bir ton üretiyordu. Tek aile içinde kalan geçiş her temada temiz görünür.
  const accentShade = useMemo(() => {
    try {
      return applyRelative(toHex(accent), { h: 24, l: 10, s: 4 });
    } catch {
      return accent;
    }
  }, [accent]);

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
  // Editör içindeki yükseltme sayfasından (harf sınırı) "Premium'a geç": ödeme
  // ekranı editörün arkasında kalmasın, editör kalkınca açılır.
  const pendingUpgradeRef = useRef(null);
  const handleEditorUpgrade = useCallback((featureId) => {
    pendingUpgradeRef.current = featureId;
    setEditorVisible(false);
  }, []);
  const handleEditorDismissed = useCallback(() => {
    const type = pendingFullTypeRef.current;
    const upgrade = pendingUpgradeRef.current;
    pendingFullTypeRef.current = null;
    pendingUpgradeRef.current = null;
    if (upgrade) openPremiumScreen(upgrade);
    else if (type) checkCanCreateNote(type);
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
            colors={[alpha(accent, 0.16), alpha(accentShade, 0.06), "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* ── Başlık satırı ── */}
          <View style={styles.headerRow}>
            <LinearGradient
              colors={[accentShade, accent]}
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
              {/* Bekleyen madde varsa alt satır onu söyler (eski ayrı rozet başlığı
                  daraltıyordu); yoksa sabit açıklama. */}
              {ready && pendingTodos > 0 ? (
                <View style={styles.subtitleRow}>
                  <View style={[styles.pendingDot, { backgroundColor: orange }]} />
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.subtitle, styles.subtitleFlush, { color: orange }]}
                  >
                    {i18nText("autoI18n.bekliyor_count", "{{count}} bekliyor", {
                      count: pendingTodos,
                    })}
                  </Text>
                </View>
              ) : (
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.subtitle, { color: theme.text.muted }]}
                >
                  {i18nText("autoI18n.notlar_ve_yapilacaklar", "Notlar ve yapılacaklar")}
                </Text>
              )}
            </View>

            {/* Görünür hızlı ekleme: basılı tutma keşfedilmesi zor bir hareketti;
                aynı sayfayı (Yeni not / Yeni liste) tek dokunuşla açar. */}
            <Pressable
              onPress={openQuickAdd}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={i18nText("autoI18n.notes_hizli_ekle", "Hızlı ekle")}
              style={({ pressed }) => [styles.addButtonWrap, pressed && styles.addButtonPressed]}
            >
              <LinearGradient
                colors={[accentShade, accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addButton}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
            <Ionicons name="chevron-forward" size={16} color={alpha(theme.text.muted, 0.8)} />
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

              <View
                style={[
                  styles.statStrip,
                  {
                    backgroundColor: alpha(theme.text.primary, 0.045),
                    borderColor: alpha(theme.text.primary, 0.08),
                  },
                ]}
              >
                <StatSegment
                  color={accent}
                  value={noteCount}
                  label={i18nText("autoI18n.not_lower", "not")}
                  theme={theme}
                />
                <View style={[styles.statDivider, { backgroundColor: alpha(theme.text.primary, 0.1) }]} />
                <StatSegment
                  color={theme.notesColor?.blue ?? accent}
                  value={todoCount}
                  label={i18nText("autoI18n.liste_lower", "liste")}
                  theme={theme}
                />
                {totalTodos > 0 && (
                  <>
                    <View style={[styles.statDivider, { backgroundColor: alpha(theme.text.primary, 0.1) }]} />
                    <StatSegment
                      color={green}
                      value={percentText(progressPct)}
                      label={i18nText("autoI18n.tamamlandi_lower", "tamamlandı")}
                      theme={theme}
                      flex={1.4}
                      progress={progressPct / 100}
                    />
                  </>
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
            textLimits={noteTextLimits}
            onTextLimit={showNoteTextLimit}
            reminderLocked={!canSetNoteReminder}
            onReminderLocked={showNoteReminderUpsell}
            onUpgrade={handleEditorUpgrade}
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
  subtitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  subtitleFlush: { marginTop: 0, fontWeight: "800", flexShrink: 1 },
  pendingDot: { width: 6, height: 6, borderRadius: 3 },
  addButtonWrap: {
    borderRadius: 17,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  addButtonPressed: { opacity: 0.85, transform: [{ scale: 0.92 }] },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    alignItems: "center",
    gap: 10,
    paddingLeft: 9,
    paddingRight: 11,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  featuredIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  featuredBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    gap: 3,
  },
  featuredRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  featuredTitle: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: "800", letterSpacing: -0.2 },
  featuredDate: { fontSize: 10.5, fontWeight: "700" },
  featuredLine: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  featuredProgress: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniTrack: { width: 34, height: 4, borderRadius: 2, overflow: "hidden" },
  miniFill: { height: 4, borderRadius: 2 },
  featuredCount: { fontSize: 10.5, fontWeight: "900" },

  // Sayı şeridi — tek parça, ince bölücülü (eski üç ayrı kutu yerine).
  statStrip: {
    height: CELL_H,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 4,
  },
  statDivider: { width: StyleSheet.hairlineWidth * 2, height: 24, borderRadius: 1 },
  segment: { minWidth: 0, paddingHorizontal: 10, justifyContent: "center", gap: 2 },
  segmentHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  segmentDot: { width: 6, height: 6, borderRadius: 3 },
  segmentLabel: { fontSize: 10, lineHeight: 12, fontWeight: "700", flexShrink: 1 },
  segmentValueRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  segmentValue: { fontSize: 16, lineHeight: 19, fontWeight: "900", letterSpacing: -0.4 },
  segmentTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  segmentFill: { height: 4, borderRadius: 2 },

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
