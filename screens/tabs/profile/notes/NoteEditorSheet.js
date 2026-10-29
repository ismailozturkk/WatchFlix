// screens/tabs/profile/notes/NoteEditorSheet.js
//
// Not / yapılacak ekle-düzenle sayfası (BottomSheetModal). Eskiden NotesScreen
// içindeydi; görünüm yenilenirken ayrıldı. İŞ MANTIĞI aynı:
//   • Todo değişiklikleri cihazdaki kullanıcı kapsamlı taslağa (MMKV) yazılır,
//     buluta yalnız "Kaydet" gider; taslak, buluttaki kayıttan eskiyse atılır.
//   • Mevcut kaydın tipi (Not ↔ Yapılacak) düzenlerken değiştirilemez.
//   • Madde ekleme/silme/sıralama/satır içi düzenleme/kopyalama.
// Yeni kullanılabilirlik:
//   • İçeriği olmayan not kaydedilemez (eskiden boş kayıt oluşabiliyordu).
//   • Kaydedilmemiş NOT metni varken kapatma onay ister (not taslağı yok).
//   • Tarih için hızlı seçenekler (Bugün / Yarın / Haftaya) + takvim.
//   • Hatırlatma hem notta hem yapılacakta: gün + SAAT (hızlı saatler + satır
//     içi saat/dakika ızgarası — ikinci bir Modal açılmaz). Saat `scheduledTime`
//     ("HH:MM"); hesaplar utils/noteReminders.js'te.
//   • Tamamlananları tek dokunuşla temizle, ilerleme şeridi, kelime sayacı,
//     sabitle anahtarı, renk seçicide seçili işareti.
//   • Not metni ve madde HARF sınırı plana göre (`textLimits`, utils/noteTextLimits.js).
//     Yazarken sınıra dayanınca yükseltme sayfası bir kez açılır — bu sayfanın
//     İÇİNDEKİ host'ta, çünkü kökteki sayfa bu native Modal'ın arkasında kalırdı.
//   • Hatırlatıcı Premium'a özel (`reminderLocked`): Free'de gün/saat seçimi aynı
//     host'ta yükseltme sayfasını açar; mevcut hatırlatıcıyı kaldırmak serbest.

import { intlLocaleOf } from "../../../../utils/appLanguages";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import BottomSheetModal from "@components/common/BottomSheetModal";
import DatePickerModal from "@components/modals/DatePickerModal";
import { PremiumUpsellHost } from "@components/premium/PremiumUpsellSheet";
import PremiumPill from "@components/premium/PremiumPill";
import { appAlert } from "@components/AppAlert";
import { toast } from "@components/AppToast";
import { i18nText } from "../../../../utils/i18nText";
import { shiftLightness } from "../../../../utils/colorUtils";
import { alpha } from "../../../../theme/colors";
import {
  getNoteTodoDraft,
  removeNoteTodoDraft,
  saveNoteTodoDraft,
  todoDraftKey,
} from "../../../../services/noteTodoDraftService";
import {
  addTodoOnTop,
  getTodoMoveAvailability,
  moveTodoItem,
  toggleTodoItem,
} from "../../../../utils/todoOrder";
import {
  countWords,
  dateOffsetISO,
  isNoteEmpty,
  todoStats,
} from "../../../../utils/notesView";
import GlassTouchable from "../../../../components/common/GlassTouchable";
import GlassBox from "../../../../components/common/GlassBox";
import { GLASS_PRESS_ROOM } from "../../../../utils/liquidGlass";
import {
  formatReminderTime,
  isReminderPast,
  isValidReminderTime,
  noteReminderAt,
  splitReminderTime,
  suggestedReminderTime,
} from "../../../../utils/noteReminders";
import { PREMIUM_PLAN } from "../../../../utils/premium";
import {
  noteTextLimitsFor,
  reachedTextLimit,
  textInputMaxLength,
} from "../../../../utils/noteTextLimits";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// Küçük ikon butonları için ortak dokunma alanı payı.
const ICON_HIT_SLOP = { top: 8, bottom: 8, left: 6, right: 6 };
// Başlık her planda aynı; not metni ve madde sınırı plana göre (`textLimits`).
export const NOTE_TITLE_LIMIT = 120;
// Çağıran sınır vermezse en kısıtlayıcı plan (kapı açık kalmasın).
const FREE_TEXT_LIMITS = noteTextLimitsFor(PREMIUM_PLAN.FREE);

const localeOf = (language) => (intlLocaleOf(language));

// Sayaç yalnız sınıra yaklaşınca belirir (%85+); aksi halde ekranı kirletir. Sınıra
// dayanınca ve üst plan daha uzununa izin veriyorsa (`onUpgrade`) ✦ ile dokunulur
// olur: yükseltme sayfasını yeniden açar. `hint` yer olan satırda yanına yazılır.
const LimitCounter = ({ value, limit, theme, style, onUpgrade, hint }) => {
  const length = String(value || "").length;
  if (!(length >= limit * 0.85)) return null;
  const full = length >= limit;
  const color = full ? "#EF4444" : theme.colors?.orange || theme.accent;
  if (!full || !onUpgrade) {
    return (
      <Text allowFontScaling={false} pointerEvents="none" style={[st.limitCounter, { color }, style]}>
        {length}/{limit}
      </Text>
    );
  }
  return (
    <TouchableOpacity
      onPress={onUpgrade}
      hitSlop={ICON_HIT_SLOP}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${length}/${limit}. ${hint || i18nText("autoI18n.notes_sinir_doldu", "Sınıra ulaştın")}`}
      style={[st.limitUpgrade, style]}
    >
      <Ionicons name="sparkles" size={11} color={theme.accent} />
      <Text allowFontScaling={false} style={[st.limitCounter, { color }]}>
        {length}/{limit}
      </Text>
      {hint ? (
        <Text allowFontScaling={false} numberOfLines={1} style={[st.limitHint, { color: theme.accent }]}>
          {hint}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

const EMPTY_TYPES = [];
const QUICK_TIMES = ["09:00", "12:00", "18:00", "21:00"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export default function NoteEditorSheet({
  visible,
  initialNote,
  defaultType,
  theme,
  colorPairs,
  language,
  onSave,
  onClose,
  // Limiti dolan tipler (ücretsiz planda 5 not / 5 yapılacak). Tip seçicide
  // kilitli görünür; basılınca `onFullTypePress` çağrılır — çağıran sayfayı
  // kapatıp yükseltme sayfasını `onDismissed` sinyalinden sonra açar (iOS iki
  // Modal'ı aynı anda sunamaz).
  fullTypes = EMPTY_TYPES,
  onFullTypePress,
  onDismissed,
  // Plana göre harf sınırları (ProfileNotesContext `noteTextLimits`). Sınıra
  // dayanınca `onTextLimit(featureId, uzunluk)` yükseltme sayfasını açar; oradan
  // "Premium'a geç" → `onUpgrade(featureId)`: çağıran bu sayfayı kapatıp ödeme
  // ekranını `onDismissed`ta açar (ekran bu Modal'ın arkasında kalırdı).
  textLimits = FREE_TEXT_LIMITS,
  onTextLimit,
  onUpgrade,
  // Hatırlatıcı Premium'a özel (ProfileNotesContext `canSetNoteReminder`). Kilitliyken
  // kurmak / günü-saati değiştirmek `onReminderLocked(preview)` ile yükseltme
  // sayfasını açar (bu sayfanın İÇİNDEKİ host'ta); kaldırmak serbest. Çağıran
  // vermezse kilitli (kapı açık kalmasın).
  reminderLocked = true,
  onReminderLocked,
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [todos, setTodos] = useState([]);
  const [pair, setPair] = useState(colorPairs[0]);
  const [type, setType] = useState(defaultType);
  const [pinned, setPinned] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");
  const [scheduledDate, setScheduledDate] = useState(null);
  const [scheduledTime, setScheduledTime] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePanel, setShowTimePanel] = useState(false);
  /* Satır içi madde düzenleme: düzenlenen maddenin id'si + taslak metni */
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingTodoText, setEditingTodoText] = useState("");
  /* Kopyalanan maddede kısa süre gösterilen onay ikonu */
  const [copiedTodoId, setCopiedTodoId] = useState(null);
  const [draftReadyKey, setDraftReadyKey] = useState(null);
  const copyTimerRef = useRef(null);
  const todoInputRef = useRef(null);
  // Bu açılışta kendiliğinden yükseltme sayfası gösterilen sınırlar (özellik
  // kimliği): sınırda silip yeniden yazan kullanıcıya sayfa tekrar tekrar açılmaz.
  const promptedLimitsRef = useRef(new Set());
  // Mevcut kaydın tipi düzenleme sırasında değiştirilemez. `type` state'i yalnızca
  // yeni kayıt oluştururken üstteki Not/Todo seçicisini yönetir.
  const activeType = initialNote
    ? initialNote.type === "todo" ? "todo" : "note"
    : type;
  const draftStorageKey = todoDraftKey(initialNote?.id);

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const todayStr = dateOffsetISO(0);
  // Gün seçilince saat boşsa önerilen saat konur (bugünse bir sonraki tam saat):
  // saatsiz hatırlatma 09:00'da çalardı, o da bugün için çoğu zaman geçmiş olur.
  // Hatırlatıcı kilitliyken (Free) gün seçen HER yol (hızlı günler, takvim seçicisi)
  // burada durur: kaldırmak (iso null) ve kaydın KENDİ hatırlatıcısını geri seçmek
  // (kaldırıp vazgeçmek; gün + saat aynen) serbest, başka her gün yükseltme sayfası.
  const pickDate = (iso) => {
    if (iso && reminderLocked) {
      if (iso === initialNote?.scheduledDate) {
        setScheduledDate(iso);
        setScheduledTime(initialNote.scheduledTime || null);
        return;
      }
      promptReminder({ scheduledDate: iso, scheduledTime: suggestedReminderTime(iso) });
      return;
    }
    setScheduledDate(iso);
    if (!iso) {
      setScheduledTime(null);
      setShowTimePanel(false);
      return;
    }
    setScheduledTime((prev) =>
      isValidReminderTime(prev) && !isReminderPast(iso, prev) ? prev : suggestedReminderTime(iso),
    );
  };
  // Kilitli hatırlatıcı: seçim uygulanmaz, yükseltme sayfası denenen günü/saati
  // bu notun başlığıyla bildirim kartı olarak gösterir (gün yoksa "seçtiğin gün").
  const promptReminder = (schedule = {}) => {
    Keyboard.dismiss();
    onReminderLocked?.({
      kind: "reminder",
      noteType: activeType,
      title: title.trim() || (activeType === "note" ? content.trim().split("\n")[0] : ""),
      ...schedule,
    });
  };
  // Saat seçen her yol (hızlı saatler, saat/dakika ızgarası) — kilitliyken aynı kural.
  const pickTime = (time) => {
    if (!reminderLocked) {
      setScheduledTime(time);
      return;
    }
    if (time !== effectiveTime) promptReminder({ scheduledDate, scheduledTime: time });
  };
  const effectiveTime = isValidReminderTime(scheduledTime) ? scheduledTime : "09:00";
  const timeParts = splitReminderTime(effectiveTime);
  const isToday = scheduledDate === todayStr;
  const timeIsPast = (time) => !!scheduledDate && isReminderPast(scheduledDate, time);
  const dateLabel = scheduledDate
    ? new Date(scheduledDate + "T12:00:00").toLocaleDateString(localeOf(language), {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : i18nText("autoI18n.notes_hatirlatici_ekle", "Hatırlatıcı ekle");

  useEffect(() => {
    if (!visible) return;
    setDraftReadyKey(null);
    if (initialNote) {
      setTitle(initialNote.title || "");
      setContent(initialNote.content || "");
      setTodos((initialNote.todos || []).map((t) => ({ ...t })));
      const found =
        colorPairs.find((p) => p.color === initialNote.color) || {
          color: initialNote.color,
          background: initialNote.backgroundColor,
        };
      setPair(found);
      setType(initialNote.type || "note");
      setPinned(!!initialNote.pinned);
      setScheduledDate(initialNote.scheduledDate || null);
      setScheduledTime(initialNote.scheduledDate ? initialNote.scheduledTime || null : null);
    } else {
      setTitle("");
      setContent("");
      setTodos([]);
      setPair(colorPairs[Math.floor(Math.random() * colorPairs.length)]);
      setType(defaultType);
      setPinned(false);
      setScheduledDate(null);
      setScheduledTime(null);
    }
    setShowTimePanel(false);
    setNewTodoText("");
    setEditingTodoId(null);
    setEditingTodoText("");
    setCopiedTodoId(null);
    promptedLimitsRef.current.clear();
  }, [visible, initialNote, defaultType]);

  // Todo değişiklikleri buluta gönderilmeden önce cihazdaki kullanıcı kapsamlı
  // taslaktan geri yüklenir. Buluttaki kayıt taslaktan daha yeniyse eski taslak
  // kullanılmaz.
  useEffect(() => {
    if (!visible || activeType !== "todo" || draftReadyKey === draftStorageKey) return;
    const draft = getNoteTodoDraft(draftStorageKey);
    const cloudUpdatedAt = Number(initialNote?.updatedAt || 0);
    const draftSourceUpdatedAt = Number(draft?.sourceUpdatedAt || 0);
    const staleDraft = !!initialNote && draftSourceUpdatedAt > 0 && cloudUpdatedAt > draftSourceUpdatedAt;

    if (staleDraft) {
      removeNoteTodoDraft(draftStorageKey);
    } else if (draft) {
      setTitle(typeof draft.title === "string" ? draft.title : initialNote?.title || "");
      setTodos(Array.isArray(draft.todos) ? draft.todos.map((item) => ({ ...item })) : []);
      setNewTodoText(typeof draft.newTodoText === "string" ? draft.newTodoText : "");
      // Hatırlatıcı kilitliyse taslağın (Premium'dayken kalmış olabilir) yeni günü
      // alınmaz: kayıt kapıya takılırdı. Kaydın kendi hatırlatıcısı kalır.
      const reminderSource = reminderLocked ? initialNote : draft;
      setScheduledDate(reminderSource?.scheduledDate || null);
      setScheduledTime(reminderSource?.scheduledDate ? reminderSource.scheduledTime || null : null);
      setEditingTodoId(draft.editingTodoId || null);
      setEditingTodoText(typeof draft.editingTodoText === "string" ? draft.editingTodoText : "");
      const savedPair = colorPairs.find((item) => item.color === draft.color);
      if (savedPair) setPair(savedPair);
    }
    setDraftReadyKey(draftStorageKey);
  }, [
    activeType,
    colorPairs,
    draftReadyKey,
    draftStorageKey,
    initialNote,
    reminderLocked,
    visible,
  ]);

  // Her madde ekleme/silme, tamamlandı işareti, sıralama ve metin değişikliği
  // senkron MMKV taslağına gider. Firestore'a yalnız alttaki Kaydet basar.
  useEffect(() => {
    if (!visible || activeType !== "todo" || draftReadyKey !== draftStorageKey) return;
    saveNoteTodoDraft(draftStorageKey, {
      title,
      todos,
      newTodoText,
      scheduledDate,
      scheduledTime,
      editingTodoId,
      editingTodoText,
      color: pair.color,
      backgroundColor: pair.background,
      sourceUpdatedAt: initialNote?.updatedAt || null,
      updatedAt: Date.now(),
    });
  }, [
    activeType,
    draftReadyKey,
    draftStorageKey,
    editingTodoId,
    editingTodoText,
    initialNote?.updatedAt,
    newTodoText,
    pair.background,
    pair.color,
    scheduledDate,
    scheduledTime,
    title,
    todos,
    visible,
  ]);

  const color = pair.color;

  /* ── Harf sınırı: yazarak sınıra dayanınca yükseltme sayfası ── */
  // Üst plan yoksa (Premium Max) sayfa açılmaz; sayaç kırmızıya döner, o kadar.
  const promptTextLimit = (entry, length) => {
    if (!entry.canUpgrade || !onTextLimit) return;
    Keyboard.dismiss();
    onTextLimit(entry.featureId, length);
  };
  const upgradeHandlerFor = (entry, value) =>
    entry.canUpgrade && onTextLimit ? () => promptTextLimit(entry, String(value || "").length) : undefined;
  // Değişiklik sınıra YENİ dayandıysa sayfayı (bu açılışta özellik başına bir kez) aç.
  const watchTextLimit = (entry, previous, next) => {
    if (!reachedTextLimit(entry.limit, previous, next)) return;
    if (promptedLimitsRef.current.has(entry.featureId)) return;
    promptedLimitsRef.current.add(entry.featureId);
    promptTextLimit(entry, next.length);
  };
  const changeContent = (text) => {
    watchTextLimit(textLimits.content, content, text);
    setContent(text);
  };
  const changeNewTodoText = (text) => {
    watchTextLimit(textLimits.todoItem, newTodoText, text);
    setNewTodoText(text);
  };
  const changeEditingTodoText = (text) => {
    watchTextLimit(textLimits.todoItem, editingTodoText, text);
    setEditingTodoText(text);
  };

  const addTodo = () => {
    if (!newTodoText.trim()) return;
    setTodos((prev) => addTodoOnTop(prev, { id: uid(), text: newTodoText.trim(), done: false }));
    setNewTodoText("");
    setTimeout(() => todoInputRef.current?.focus(), 50);
  };
  const toggleTodo = (id) => setTodos((prev) => toggleTodoItem(prev, id));
  const deleteTodo = (id) => {
    if (editingTodoId === id) {
      setEditingTodoId(null);
      setEditingTodoText("");
    }
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };
  const clearCompleted = () => {
    if (editingTodoId && todos.find((t) => t.id === editingTodoId)?.done) {
      setEditingTodoId(null);
      setEditingTodoText("");
    }
    setTodos((prev) => prev.filter((t) => !t.done));
  };

  /* ── Madde aksiyonları: düzenle / kopyala ── */
  const startEditTodo = (item) => {
    // Başka bir madde düzenleniyorsa taslağı çöpe atma, önce onu yaz.
    const pending = editingTodoText.trim();
    if (editingTodoId && editingTodoId !== item.id && pending) {
      setTodos((prev) =>
        prev.map((t) => (t.id === editingTodoId ? { ...t, text: pending } : t)),
      );
    }
    setEditingTodoId(item.id);
    setEditingTodoText(item.text);
  };
  const cancelEditTodo = () => {
    setEditingTodoId(null);
    setEditingTodoText("");
  };
  const commitEditTodo = () => {
    const text = editingTodoText.trim();
    // Boş bırakılırsa düzenleme iptal edilir; silmek için çöp kutusu kullanılır.
    if (text) {
      setTodos((prev) =>
        prev.map((t) => (t.id === editingTodoId ? { ...t, text } : t)),
      );
    }
    cancelEditTodo();
  };
  const copyTodo = async (item) => {
    if (!item.text?.trim()) return;
    await Clipboard.setStringAsync(item.text);
    toast.success(i18nText("autoI18n.panoya_kopyalandi", "Panoya kopyalandı"));
    // Toast sayfanın üstünde görünür (BottomSheetModal kendi host'unu taşır); ayrıca
    // satırda da kısa bir onay göster — kullanıcının gözü zaten oradadır.
    setCopiedTodoId(item.id);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedTodoId(null), 1200);
  };

  const moveTodo = (id, direction) => {
    setTodos((prev) => moveTodoItem(prev, id, direction));
  };

  /* Kaydedilecek not nesnesi (kaydet + boşluk kontrolü + kirli kontrolü ortak). */
  const buildNote = () => {
    const base = initialNote || { id: uid(), createdAt: Date.now() };
    const cleanContent = activeType === "note" ? content : "";
    // Bir madde düzenlenirken kaydedilirse taslak metin kaybolmasın.
    const pendingText = editingTodoText.trim();
    const cleanTodos =
      activeType === "todo"
        ? todos.map((t) =>
            t.id === editingTodoId && pendingText ? { ...t, text: pendingText } : t,
          )
        : [];
    // Hatırlatma hem notta hem yapılacakta düzenlenir; saat yalnız günle birlikte anlamlı.
    const cleanScheduled = scheduledDate || null;
    const cleanTime = cleanScheduled && isValidReminderTime(scheduledTime) ? scheduledTime : null;

    return {
      id: base.id,
      createdAt: base.createdAt,
      type: activeType,
      title: title.trim(),
      content: cleanContent,
      todos: cleanTodos,
      color: pair.color,
      backgroundColor: pair.background,
      pinned,
      scheduledDate: cleanScheduled,
      scheduledTime: cleanTime,
    };
  };

  // Hatırlatma bu oturumda değişti mi? (Geçmiş zamanlı ESKİ bir hatırlatmayla
  // not kaydı engellenmesin — yalnız yeni kurulan/değiştirilen denetlenir.)
  const reminderChanged =
    (scheduledDate || null) !== (initialNote?.scheduledDate || null) ||
    (scheduledDate ? scheduledTime || null : null) !==
      (initialNote?.scheduledDate ? initialNote?.scheduledTime || null : null);

  /** Kaydedildiyse true (doğrulamaya takılırsa uyarır ve false döner). */
  const handleSave = async () => {
    const note = buildNote();
    if (isNoteEmpty(note)) {
      toast.warning(
        activeType === "todo"
          ? i18nText("autoI18n.en_az_bir_todo_maddesi_girin", "En az bir yapılacak madde girin")
          : i18nText("autoI18n.bos_not_olusturulamaz", "Boş not oluşturulamaz"),
      );
      return false;
    }
    if (reminderChanged && note.scheduledDate && (noteReminderAt(note) ?? 0) <= Date.now()) {
      toast.warning(i18nText("autoI18n.notes_gecmis_zaman", "Hatırlatma zamanı geçmişte olamaz"));
      setShowTimePanel(true);
      return false;
    }
    const saved = await onSave(note);
    if (saved !== false && activeType === "todo") {
      removeNoteTodoDraft(draftStorageKey);
    }
    return saved !== false;
  };

  // Not metninin taslağı tutulmaz (todo'nun tutulur): kaydedilmemiş yazı varken
  // dışarı dokunmak/geri tuşu sessizce atmak yerine sorulur.
  const noteDirty =
    activeType === "note" &&
    (initialNote
      ? title.trim() !== (initialNote.title || "").trim() ||
        content !== (initialNote.content || "") ||
        pair.color !== initialNote.color ||
        pinned !== !!initialNote.pinned ||
        reminderChanged
      : title.trim().length > 0 || content.trim().length > 0 || !!scheduledDate);

  const requestClose = () => {
    if (!noteDirty) {
      onClose();
      return;
    }
    appAlert(
      i18nText("autoI18n.notes_kaydedilmemis_baslik", "Değişiklikler kaydedilmedi"),
      i18nText(
        "autoI18n.notes_kaydedilmemis_mesaj",
        "Bu notta kaydedilmemiş değişiklikler var. Çıkarsan kaybolacak.",
      ),
      [
        { text: i18nText("autoI18n.iptal", "İptal"), style: "cancel" },
        { text: i18nText("autoI18n.cik", "Çık"), style: "destructive", onPress: onClose },
        { text: i18nText("autoI18n.kaydet", "Kaydet"), onPress: handleSave },
      ],
    );
  };

  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);
  const stats = todoStats({ todos });
  const words = useMemo(() => countWords(content), [content]);
  const empty = isNoteEmpty({ type: activeType, title, content, todos });

  // Yükseltme sayfasından "Premium'a geç". Ödeme ekranı bu sayfanın arkasında
  // açılacağı için sayfa kapanmalı; notun taslağı tutulmadığından yazılan önce
  // kaydedilir (yapılacakların taslağı zaten cihazda). Kayıt olmazsa (ör. geçmiş
  // hatırlatma saati) sayfa açık kalır, uyarı görünür.
  const handleUpgrade = async (featureId) => {
    if (noteDirty && !empty) {
      const saved = await handleSave();
      if (!saved) return;
    }
    onUpgrade?.(featureId);
  };

  /* Tek satır: yapılacak / yapılan ayrımı `item.done` ile yapılır. */
  const renderTodoRow = (item) => {
    const isEditing = editingTodoId === item.id;
    const isCopied = copiedTodoId === item.id;
    const { canMoveUp, canMoveDown } = getTodoMoveAvailability(todos, item.id);
    return (
      <View key={item.id} style={[st.todoRow, { borderBottomColor: alpha(color, 0.14) }]}>
        <TouchableOpacity
          onPress={() => toggleTodo(item.id)}
          disabled={isEditing}
          hitSlop={ICON_HIT_SLOP}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!item.done }}
        >
          <Ionicons
            name={item.done ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={isEditing ? theme.text.muted : color}
          />
        </TouchableOpacity>

        {isEditing ? (
          <View style={st.todoEditField}>
            <TextInput
              allowFontScaling={false}
              style={[st.todoItemText, st.todoEditInput, { color: theme.text.primary, borderBottomColor: color }]}
              value={editingTodoText}
              onChangeText={changeEditingTodoText}
              maxLength={textInputMaxLength(textLimits.todoItem.limit, editingTodoText)}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={commitEditTodo}
            />
            <LimitCounter
              value={editingTodoText}
              limit={textLimits.todoItem.limit}
              theme={theme}
              style={st.todoEditCounter}
              onUpgrade={upgradeHandlerFor(textLimits.todoItem, editingTodoText)}
            />
          </View>
        ) : (
          // Satıra dokunmak düzenlemeyi açar (ayrı kalem ikonuna gerek yok).
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => startEditTodo(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text
              allowFontScaling={false}
              fontRole="body"
              style={[
                st.todoItemText,
                {
                  color: item.done ? theme.text.muted : theme.text.primary,
                  textDecorationLine: item.done ? "line-through" : "none",
                },
              ]}
            >
              {item.text}
            </Text>
          </TouchableOpacity>
        )}

        <View style={st.todoRowActions}>
          {isEditing ? (
            <>
              <TouchableOpacity onPress={commitEditTodo} hitSlop={ICON_HIT_SLOP}>
                <Ionicons name="checkmark-circle" size={22} color={color} />
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelEditTodo} hitSlop={ICON_HIT_SLOP}>
                <Ionicons name="close-circle" size={22} color={theme.text.muted} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={st.moveCol}>
                <TouchableOpacity
                  onPress={() => moveTodo(item.id, "up")}
                  disabled={!canMoveUp}
                  hitSlop={ICON_HIT_SLOP}
                  style={{ opacity: canMoveUp ? 1 : 0.25 }}
                  accessibilityRole="button"
                  accessibilityLabel={i18nText("autoI18n.maddeyi_yukari_tasi", "Maddeyi yukarı taşı")}
                >
                  <Ionicons name="chevron-up" size={16} color={theme.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => moveTodo(item.id, "down")}
                  disabled={!canMoveDown}
                  hitSlop={ICON_HIT_SLOP}
                  style={{ opacity: canMoveDown ? 1 : 0.25 }}
                  accessibilityRole="button"
                  accessibilityLabel={i18nText("autoI18n.maddeyi_asagi_tasi", "Maddeyi aşağı taşı")}
                >
                  <Ionicons name="chevron-down" size={16} color={theme.text.secondary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => copyTodo(item)} hitSlop={ICON_HIT_SLOP}>
                <Ionicons
                  name={isCopied ? "checkmark-done" : "copy-outline"}
                  size={16}
                  color={isCopied ? color : theme.text.muted}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteTodo(item.id)} hitSlop={ICON_HIT_SLOP}>
                <Ionicons name="trash-outline" size={16} color={theme.text.muted} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // Hızlı tarih seçenekleri
  const presets = [
    { key: "today", label: i18nText("autoI18n.bugun", "Bugün"), value: dateOffsetISO(0) },
    { key: "tomorrow", label: i18nText("autoI18n.notes_yarin", "Yarın"), value: dateOffsetISO(1) },
    { key: "week", label: i18nText("autoI18n.notes_haftaya", "Haftaya"), value: dateOffsetISO(7) },
  ];

  const saveGradient = [color, shiftLightness(color, -14)];

  // Klavye kaldırması BottomSheetModal'ın içinde (hooks/useSheetTransition.js) —
  // ayrı KeyboardAvoidingView gerekmiyor.
  return (
    <BottomSheetModal
      visible={visible}
      onClose={requestClose}
      onDismissed={onDismissed}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[st.sheet, { backgroundColor: theme.secondary }]}
    >
      <View style={[st.handle, { backgroundColor: theme.border }]} />

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Üst satır: tip (yalnız yeni kayıtta seçilebilir) + sabitle */}
        <View style={st.topRow}>
          {!initialNote ? (
            <View style={[st.typeSwitch, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              {["note", "todo"].map((tp) => {
                const active = activeType === tp;
                const full = fullTypes.includes(tp);
                return (
                  <GlassTouchable
                    key={tp}
                    style={[
                      st.typeBtn,
                      active && { backgroundColor: alpha(color, 0.18), borderColor: alpha(color, 0.55) },
                      full && st.typeBtnFull,
                    ]}
                    onPress={() => (full ? onFullTypePress?.(tp) : setType(tp))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: full }}
                  >
                    <Ionicons
                      name={full ? "lock-closed" : tp === "note" ? "document-text" : "checkbox"}
                      size={15}
                      color={active ? color : theme.text.secondary}
                    />
                    <Text
                      allowFontScaling={false}
                      style={[
                        st.typeBtnText,
                        { color: active ? theme.text.primary : theme.text.secondary, fontWeight: active ? "800" : "600" },
                      ]}
                    >
                      {tp === "note"
                        ? i18nText("autoI18n.not", "Not")
                        : i18nText("autoI18n.yapilacak", "Yapılacak")}
                    </Text>
                  </GlassTouchable>
                );
              })}
            </View>
          ) : (
            <View style={[st.typeBadge, { backgroundColor: alpha(color, 0.16), borderColor: alpha(color, 0.4) }]}>
              <Ionicons name={activeType === "todo" ? "checkbox" : "document-text"} size={15} color={color} />
              <Text allowFontScaling={false} style={[st.typeBadgeText, { color }]}>
                {activeType === "todo"
                  ? i18nText("autoI18n.yapilacak", "Yapılacak")
                  : i18nText("autoI18n.not", "Not")}
              </Text>
            </View>
          )}

          <GlassTouchable
            onPress={() => setPinned((v) => !v)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: pinned }}
            accessibilityLabel={
              pinned
                ? i18nText("autoI18n.notes_sabitlemeyi_kaldir", "Sabitlemeyi kaldır")
                : i18nText("autoI18n.notes_sabitle", "Sabitle")
            }
            style={[
              st.pinBtn,
              {
                backgroundColor: pinned ? alpha(color, 0.18) : theme.primary,
                borderColor: pinned ? alpha(color, 0.55) : theme.border,
              },
            ]}
          >
            <Ionicons name={pinned ? "pin" : "pin-outline"} size={19} color={pinned ? color : theme.text.secondary} />
          </GlassTouchable>
        </View>

        {/* Renk seçici: seçili renkte onay işareti */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.colorRow}
          style={st.colorScroll}
          accessibilityLabel={i18nText("autoI18n.notes_secili_renk", "Not rengi")}
        >
          {colorPairs.map((p) => {
            const selected = pair.color === p.color;
            return (
              <TouchableOpacity
                key={p.color}
                onPress={() => setPair(p)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  st.swatchRing,
                  selected && { borderColor: alpha(p.color, 0.55) },
                ]}
              >
                <View style={[st.swatch, { backgroundColor: p.color }]}>
                  {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Kağıt: seçilen rengin zemin tonu + renkli çerçeve */}
        <View style={[st.paper, { backgroundColor: theme.primary, borderColor: alpha(color, 0.38) }]}>
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: pair.background || alpha(color, 0.12) }]}
          />
          <View style={[st.paperBar, { backgroundColor: color }]} />

          <View style={st.paperBody}>
            <TextInput
              allowFontScaling={false}
              style={[st.titleInput, { color: theme.text.primary }]}
              placeholder={i18nText("autoI18n.baslik", "Başlık")}
              placeholderTextColor={theme.text.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={NOTE_TITLE_LIMIT}
              returnKeyType="next"
            />
            <LimitCounter value={title} limit={NOTE_TITLE_LIMIT} theme={theme} style={st.titleCounter} />
            <View style={[st.paperDivider, { backgroundColor: alpha(color, 0.28) }]} />

            {activeType === "note" ? (
              <>
                <TextInput
                  allowFontScaling={false}
                  style={[st.contentInput, { color: theme.text.primary }]}
                  placeholder={i18nText("autoI18n.notunu_yaz", "Notunuzu buraya yazın…")}
                  placeholderTextColor={theme.text.muted}
                  multiline
                  value={content}
                  onChangeText={changeContent}
                  maxLength={textInputMaxLength(textLimits.content.limit, content)}
                  textAlignVertical="top"
                />
                <View style={st.contentFooter}>
                  <Ionicons name="text-outline" size={12} color={theme.text.muted} />
                  <Text allowFontScaling={false} style={[st.footerText, { color: theme.text.muted }]}>
                    {i18nText("autoI18n.notes_kelime_n", "{{n}} kelime", { n: words })}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <LimitCounter
                    value={content}
                    limit={textLimits.content.limit}
                    theme={theme}
                    style={st.inlineCounter}
                    onUpgrade={upgradeHandlerFor(textLimits.content, content)}
                    hint={
                      textLimits.content.upgradePlanName
                        ? i18nText("autoI18n.notes_plan_ile_daha_uzun", "{{plan}} ile daha uzun", {
                            plan: textLimits.content.upgradePlanName,
                          })
                        : null
                    }
                  />
                </View>
              </>
            ) : (
              <>
                {/* İlerleme + tamamlananları temizle */}
                {stats.total > 0 && (
                  <View style={st.progressRow}>
                    <View style={[st.progressTrack, { backgroundColor: alpha(color, 0.2) }]}>
                      <View style={[st.progressFill, { backgroundColor: color, width: `${stats.progress * 100}%` }]} />
                    </View>
                    <Text allowFontScaling={false} style={[st.progressText, { color }]}>
                      {i18nText("autoI18n.notes_n_tamamlandi", "{{done}}/{{total}} tamamlandı", {
                        done: stats.done,
                        total: stats.total,
                      })}
                    </Text>
                  </View>
                )}

                {activeTodos.length > 0 && (
                  <>
                    <Text allowFontScaling={false} style={[st.sectionLabel, { color: theme.text.muted }]}>
                      {i18nText("autoI18n.yapilacaklar_upper", "YAPILACAKLAR")}
                    </Text>
                    {activeTodos.map(renderTodoRow)}
                  </>
                )}

                {doneTodos.length > 0 && (
                  <>
                    <View style={st.doneHeader}>
                      <Text allowFontScaling={false} style={[st.sectionLabel, { color, marginBottom: 0 }]}>
                        {i18nText("autoI18n.yapilanlar_upper", "YAPILANLAR")}
                      </Text>
                      <GlassTouchable
                        onPress={clearCompleted}
                        hitSlop={ICON_HIT_SLOP}
                        style={[st.clearBtn, { backgroundColor: alpha(color, 0.14) }]}
                        accessibilityRole="button"
                      >
                        <Ionicons name="trash-bin-outline" size={12} color={color} />
                        <Text allowFontScaling={false} style={[st.clearBtnText, { color }]}>
                          {i18nText("autoI18n.notes_tamamlananlari_temizle", "Tamamlananları temizle")}
                        </Text>
                      </GlassTouchable>
                    </View>
                    {doneTodos.map(renderTodoRow)}
                  </>
                )}

                {todos.length === 0 && (
                  <Text allowFontScaling={false} style={[st.todoHint, { color: theme.text.muted }]}>
                    {i18nText("autoI18n.yeni_madde_ekle", "Yeni madde ekle…")}
                  </Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Hatırlatma (not + yapılacak): gün (hızlı seçenekler + takvim), gün seçilince saat. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.dateRow}
          style={st.dateScroll}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => (reminderLocked ? promptReminder() : setShowDatePicker(true))}
            activeOpacity={0.85}
            style={[
              st.dateChip,
              {
                backgroundColor: scheduledDate ? alpha(color, 0.16) : theme.primary,
                borderColor: scheduledDate ? color : theme.border,
              },
            ]}
          >
            <Ionicons name="calendar" size={14} color={scheduledDate ? color : theme.text.muted} />
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[st.dateChipText, { color: scheduledDate ? color : theme.text.secondary }]}
            >
              {dateLabel}
            </Text>
            {reminderLocked && !scheduledDate ? <PremiumPill color={color} /> : null}
            {scheduledDate ? (
              <TouchableOpacity onPress={() => pickDate(null)} hitSlop={ICON_HIT_SLOP}>
                <Ionicons name="close-circle" size={15} color={theme.text.muted} />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
          {presets.map((p) => {
            const selected = scheduledDate === p.value;
            return (
              <GlassTouchable
                key={p.key}
                onPress={() => pickDate(selected ? null : p.value)}
                activeOpacity={0.85}
                style={[
                  st.presetChip,
                  {
                    backgroundColor: selected ? color : theme.primary,
                    borderColor: selected ? color : theme.border,
                  },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[st.presetText, { color: selected ? "#fff" : theme.text.secondary }]}
                >
                  {p.label}
                </Text>
              </GlassTouchable>
            );
          })}
        </ScrollView>

        {/* Saat: gün seçilince görünür. Hızlı saatler + açılır saat/dakika ızgarası. */}
        {scheduledDate ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.dateRow}
            style={st.dateScroll}
            keyboardShouldPersistTaps="handled"
          >
            <GlassTouchable
              onPress={() =>
                reminderLocked
                  ? promptReminder({ scheduledDate, scheduledTime: effectiveTime })
                  : setShowTimePanel((v) => !v)
              }
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ expanded: showTimePanel }}
              accessibilityLabel={`${i18nText("autoI18n.notes_hatirlatma_saati", "Hatırlatma saati")}: ${effectiveTime}`}
              style={[
                st.dateChip,
                {
                  backgroundColor: alpha(color, 0.16),
                  borderColor: timeIsPast(effectiveTime) ? theme.colors?.red || "#EF4444" : color,
                },
              ]}
            >
              <Ionicons name="alarm" size={14} color={color} />
              <Text allowFontScaling={false} style={[st.dateChipText, st.timeChipText, { color }]}>
                {effectiveTime}
              </Text>
              <Ionicons name={showTimePanel ? "chevron-up" : "chevron-down"} size={14} color={color} />
            </GlassTouchable>
            {QUICK_TIMES.map((time) => {
              const selected = effectiveTime === time;
              const past = timeIsPast(time);
              return (
                <GlassTouchable
                  key={time}
                  onPress={() => pickTime(time)}
                  disabled={past}
                  activeOpacity={0.85}
                  accessibilityState={{ selected, disabled: past }}
                  style={[
                    st.presetChip,
                    {
                      backgroundColor: selected ? color : theme.primary,
                      borderColor: selected ? color : theme.border,
                      opacity: past ? 0.35 : 1,
                    },
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[st.presetText, st.timeChipText, { color: selected ? "#fff" : theme.text.secondary }]}
                  >
                    {time}
                  </Text>
                </GlassTouchable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Satır içi saat seçici (ikinci Modal yok): saat (24) + dakika (5'er). Bugün için geçmiş hücreler kapalı. */}
        {scheduledDate && showTimePanel ? (
          <View style={[st.timePanel, { backgroundColor: theme.primary, borderColor: alpha(color, 0.35) }]}>
            <Text allowFontScaling={false} style={[st.sectionLabel, st.timePanelLabel, { color: theme.text.muted }]}>
              {i18nText("autoI18n.notes_saat", "Saat").toLocaleUpperCase(localeOf(language))}
            </Text>
            <View style={st.timeGrid}>
              {HOURS.map((hour) => {
                const selected = timeParts?.hour === hour;
                // Saat hücresi, o saatin SON dakikası da geçmişse kapalı.
                const past = isToday && timeIsPast(formatReminderTime(hour, 59));
                return (
                  <GlassTouchable
                    key={hour}
                    disabled={past}
                    onPress={() => {
                      const next = formatReminderTime(hour, timeParts?.minute ?? 0);
                      if (!timeIsPast(next)) {
                        pickTime(next);
                        return;
                      }
                      // Bu saatte seçili dakika geçmiş: o saatin ilk geçerli 5'liğine kay.
                      const free = MINUTES.find((m) => !timeIsPast(formatReminderTime(hour, m)));
                      pickTime(formatReminderTime(hour, free ?? 59));
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: past }}
                    style={[
                      st.timeCell,
                      { backgroundColor: selected ? color : alpha(color, 0.08), opacity: past ? 0.3 : 1 },
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[st.timeCellText, { color: selected ? "#fff" : theme.text.primary }]}
                    >
                      {String(hour).padStart(2, "0")}
                    </Text>
                  </GlassTouchable>
                );
              })}
            </View>
            <Text allowFontScaling={false} style={[st.sectionLabel, st.timePanelLabel, { color: theme.text.muted }]}>
              {i18nText("autoI18n.notes_dakika", "Dakika").toLocaleUpperCase(localeOf(language))}
            </Text>
            <View style={st.timeGrid}>
              {MINUTES.map((minute) => {
                const hour = timeParts?.hour ?? 9;
                const selected = timeParts?.minute === minute;
                const past = isToday && timeIsPast(formatReminderTime(hour, minute));
                return (
                  <GlassTouchable
                    key={minute}
                    disabled={past}
                    onPress={() => pickTime(formatReminderTime(hour, minute))}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: past }}
                    style={[
                      st.timeCell,
                      { backgroundColor: selected ? color : alpha(color, 0.08), opacity: past ? 0.3 : 1 },
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[st.timeCellText, { color: selected ? "#fff" : theme.text.primary }]}
                    >
                      :{String(minute).padStart(2, "0")}
                    </Text>
                  </GlassTouchable>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Madde ekleme: kaydırma alanının DIŞINDA — liste uzayınca da erişilebilir kalsın */}
      {activeType === "todo" && (
        <View style={st.addTodoRow}>
          <GlassBox role="field" style={[st.addTodoInputShell, { borderColor: alpha(color, 0.5), backgroundColor: theme.primary }]}>
            <TextInput
              ref={todoInputRef}
              allowFontScaling={false}
              style={[st.addTodoInput, { color: theme.text.primary }]}
              placeholder={i18nText("autoI18n.yeni_madde_ekle", "Yeni madde ekle…")}
              placeholderTextColor={theme.text.muted}
              value={newTodoText}
              onChangeText={changeNewTodoText}
              maxLength={textInputMaxLength(textLimits.todoItem.limit, newTodoText)}
              onSubmitEditing={addTodo}
              returnKeyType="done"
              blurOnSubmit={false}
            />
            <LimitCounter
              value={newTodoText}
              limit={textLimits.todoItem.limit}
              theme={theme}
              style={st.todoInputCounter}
              onUpgrade={upgradeHandlerFor(textLimits.todoItem, newTodoText)}
            />
          </GlassBox>
          <GlassTouchable
            onPress={addTodo}
            activeOpacity={0.85}
            hitSlop={ICON_HIT_SLOP}
            style={[st.addTodoButton, { backgroundColor: newTodoText.trim() ? color : alpha(color, 0.2) }]}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={26} color={newTodoText.trim() ? "#fff" : color} />
          </GlassTouchable>
        </View>
      )}

      <TouchableOpacity onPress={handleSave} activeOpacity={0.85} style={empty ? st.saveDim : null}>
        <LinearGradient colors={saveGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.saveBtn}>
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text allowFontScaling={false} style={st.saveBtnText}>
            {i18nText("autoI18n.kaydet", "Kaydet")}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <DatePickerModal
        visible={showDatePicker}
        value={scheduledDate || todayStr}
        onConfirm={(d) => {
          const iso = typeof d === "string" ? d : d.toISOString().split("T")[0];
          pickDate(iso);
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
        title={i18nText("autoI18n.hatirlatici_tarihi", "Hatırlatıcı Tarihi")}
        subtitle={i18nText("autoI18n.bu_not_icin_hatirlatma_tarihi_secin", "Bu not için hatırlatma tarihi seçin")}
        confirmLabel={i18nText("autoI18n.tarih_sec", "Tarihi Seç")}
        minDate={new Date()}
        minDateErrorMsg={i18nText("autoI18n.gecmis_bir_tarih_secilemez", "Geçmiş bir tarih seçilemez")}
      />

      {/* Sayfa açıkken gelen yükseltme istekleri (harf sınırı, hatırlatıcı) burada, bu Modal'ın
          ÇOCUĞU olarak açılır; kökteki host bu pencerenin arkasında kalırdı. */}
      <PremiumUpsellHost scoped enabled={visible} onUpgrade={handleUpgrade} />
    </BottomSheetModal>
  );
}

const st = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: "92%",
    gap: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center" },
  // Üst satırdaki ve yandaki cam düğmeler basılınca kaydırma sınırında kesilmesin: üstte ve
  // yanlarda GLASS_PRESS_ROOM (dolgu + sayfanın 18 pt yan / 12 pt aralık boşluğuna taşan
  // negatif dış boşluk; yerleşim aynı).
  scroll: { flexShrink: 1, marginTop: -GLASS_PRESS_ROOM, marginHorizontal: -GLASS_PRESS_ROOM },
  scrollContent: { gap: 12, paddingTop: GLASS_PRESS_ROOM, paddingBottom: 4, paddingHorizontal: GLASS_PRESS_ROOM },

  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  typeSwitch: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  typeBtnText: { fontSize: 13 },
  typeBtnFull: { opacity: 0.6 },
  typeBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 14, fontWeight: "800" },
  pinBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  colorScroll: { flexGrow: 0, marginHorizontal: -2 },
  colorRow: { paddingHorizontal: 2, paddingVertical: 2, gap: 8, alignItems: "center" },
  swatchRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },

  paper: { borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  paperBar: { height: 4 },
  paperBody: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  titleInput: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3, paddingVertical: 8, paddingHorizontal: 0 },
  titleCounter: { alignSelf: "flex-end", marginTop: -2, marginBottom: 2 },
  paperDivider: { height: StyleSheet.hairlineWidth, marginBottom: 8 },
  contentInput: {
    minHeight: 190,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 8,
  },
  contentFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  footerText: { fontSize: 11, fontWeight: "700" },
  limitCounter: { fontSize: 10.5, fontWeight: "800" },
  limitUpgrade: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  limitHint: { fontSize: 10.5, fontWeight: "800", flexShrink: 1 },
  inlineCounter: {},

  // Yapılacaklar
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  progressText: { fontSize: 11.5, fontWeight: "800" },
  sectionLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: 2, marginTop: 6 },
  doneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 2,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  clearBtnText: { fontSize: 10.5, fontWeight: "800" },
  todoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  todoItemText: { fontSize: 15, lineHeight: 21 },
  todoRowActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  moveCol: { alignItems: "center", gap: 2 },
  todoEditField: { flex: 1, position: "relative" },
  todoEditInput: {
    width: "100%",
    borderBottomWidth: 1,
    paddingTop: 2,
    paddingBottom: 11,
    paddingHorizontal: 0,
  },
  todoEditCounter: { position: "absolute", right: 0, bottom: 0 },
  todoHint: { fontSize: 13, paddingVertical: 14, textAlign: "center" },

  // Hatırlatıcı
  // Basılan cam tarih hapı kırpma sınırında kesilmesin: dört yanda GLASS_PRESS_ROOM; eski 2 pt'nin
  // fazlası negatif dış boşlukla düşülür (yerleşim aynı).
  dateScroll: { flexGrow: 0, marginVertical: 2 - GLASS_PRESS_ROOM, marginHorizontal: -GLASS_PRESS_ROOM },
  dateRow: { gap: 8, alignItems: "center", paddingVertical: GLASS_PRESS_ROOM, paddingHorizontal: GLASS_PRESS_ROOM },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 40,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 230,
  },
  dateChipText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1 },
  presetChip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  presetText: { fontSize: 12.5, fontWeight: "800" },
  timeChipText: { fontVariant: ["tabular-nums"] },
  timePanel: { borderRadius: 20, borderWidth: 1, padding: 12, gap: 6 },
  timePanelLabel: { marginTop: 0 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  // 6 sütun: (100% - 5 × 6 pt boşluk) / 6 ≈ %15,2.
  timeCell: {
    width: "15.2%",
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  timeCellText: { fontSize: 13.5, fontWeight: "800", fontVariant: ["tabular-nums"] },

  // Madde ekleme
  addTodoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addTodoInputShell: {
    flex: 1,
    height: 48,
    position: "relative",
    borderRadius: 16,
    borderWidth: 1,
    paddingLeft: 14,
  },
  addTodoInput: { flex: 1, fontSize: 15, paddingVertical: 8, paddingLeft: 0, paddingRight: 36 },
  todoInputCounter: { position: "absolute", right: 8, bottom: 3 },
  addTodoButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  saveBtn: {
    height: 54,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveDim: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
