import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheetModal from "../common/BottomSheetModal";
import SheetScroll from "../common/SheetScroll";
import { useTheme } from "../../context/ThemeContext";
import GlassCloseButton from "../common/GlassCloseButton";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
import { useMediaNotes, mediaNoteItemKey } from "../../context/MediaNotesContext";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { toast } from "../AppToast";

const NOTE_TEXT_LIMIT = 2000;

// Film/dizi detay sayfasındaki "Notum" kartından VE profildeki Notlar
// ekranının "Film/Dizi" sekmesinden aynen kullanılır — tek kaynak, iki giriş
// noktası. `type`/`mediaId`/`title`/`posterPath` çağıran taraftan gelir;
// mevcut not (varsa) context'teki reaktif `mediaNotes` dizisinden okunur.
export default function MediaNoteSheet({ visible, onClose, type, mediaId, title, posterPath }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { mediaNotes, saveMediaNote, deleteMediaNote } = useMediaNotes();
  const { getTmdbUrl } = useImageQualitySettings();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const submitLock = useRef(false);

  const mediaType = type === "tv" ? "tv" : "movie";
  const existing = mediaId
    ? mediaNotes.find((n) => n.id === mediaNoteItemKey(mediaType, mediaId)) || null
    : null;

  useEffect(() => {
    if (!visible) return;
    setText(existing?.text || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, existing?.text]);

  const isBusy = submitting || deleting;

  const closeSheet = () => {
    if (isBusy) return;
    onClose?.();
  };

  const handleSave = async () => {
    if (!text.trim() || isBusy || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const ok = await saveMediaNote({ type: mediaType, mediaId, title, posterPath, text });
      if (ok) {
        onClose?.();
        toast.success(i18nText("autoI18n.toast_not_kaydedildi", "Not kaydedildi"));
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (isBusy) return;
    setDeleting(true);
    try {
      await deleteMediaNote(mediaType, mediaId);
      onClose?.();
      toast.info(i18nText("autoI18n.toast_not_silindi", "Not silindi"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={closeSheet}
      intensity={38}
      dimColor="rgba(0,0,0,0.42)"
      dismissOnBackdropPress={!isBusy}
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          paddingBottom: Math.max(insets.bottom + 22, 34),
        },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      {/* Klavye açıkken sayfa küçülür: başlık + not alanı kayar, Kaydet/Sil
          satırı klavyenin hemen üstünde sabit kalır. */}
      <SheetScroll>
      <View style={styles.header}>
        {posterPath ? (
          <Image source={{ uri: getTmdbUrl(posterPath, "poster", 200) }} style={styles.poster} />
        ) : (
          <View style={[styles.posterFallback, { backgroundColor: theme.between }]}>
            <Ionicons name={mediaType === "tv" ? "tv-outline" : "film-outline"} size={20} color={theme.text.muted} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.title, { color: theme.text.primary }]}
          >
            {title || i18nText("autoI18n.notum", "Notum")}
          </Text>
          <View style={[styles.scopePill, { backgroundColor: alpha(theme.accent, 0.11) }]}>
            <Ionicons name={mediaType === "tv" ? "tv-outline" : "film-outline"} size={11} color={theme.accent} />
            <Text allowFontScaling={false} style={[styles.scopeText, { color: theme.accent }]}>
              {mediaType === "tv" ? i18nText("autoI18n.dizi", "Dizi") : i18nText("autoI18n.film", "Film")}
            </Text>
          </View>
        </View>
        <GlassCloseButton
          size={34}
          fallbackRadius={11}
          backgroundColor={theme.between}
          disabled={isBusy}
          onPress={closeSheet}
        />
      </View>

      <View style={[styles.textField, { backgroundColor: theme.primary, borderColor: theme.border }]}>
        <TextInput
          allowFontScaling={false}
          style={[styles.textInput, { color: theme.text.primary }]}
          placeholder={i18nText(
            "autoI18n.bu_yapim_hakkinda_notunu_yaz",
            "Bu yapım hakkında notunu buraya yaz…",
          )}
          placeholderTextColor={theme.text.muted}
          multiline
          value={text}
          onChangeText={setText}
          maxLength={NOTE_TEXT_LIMIT}
          textAlignVertical="top"
          editable={!isBusy}
        />
        <Text allowFontScaling={false} style={[styles.counter, { color: theme.text.muted }]}>
          {Math.max(0, NOTE_TEXT_LIMIT - text.length)}
        </Text>
      </View>
      </SheetScroll>

      <View style={styles.actionsRow}>
        {!!existing && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={i18nText("autoI18n.notu_sil", "Notu Sil")}
            style={[styles.deleteButton, { backgroundColor: "#ef444422", borderColor: "#ef444455" }]}
            disabled={isBusy}
            onPress={handleDelete}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: !text.trim() || isBusy }}
          activeOpacity={0.85}
          disabled={!text.trim() || isBusy}
          onPress={handleSave}
          style={[
            styles.saveButton,
            { backgroundColor: text.trim() && !isBusy ? theme.accent : theme.border },
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="checkmark-done" size={19} color="#FFFFFF" />
          )}
          <Text allowFontScaling={false} style={styles.saveButtonText}>
            {i18nText("autoI18n.kaydet", "Kaydet")}
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 34,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 16 },
  poster: { width: 42, height: 60, borderRadius: 10 },
  posterFallback: { width: 42, height: 60, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: "800", letterSpacing: -0.25 },
  scopePill: { alignSelf: "flex-start", marginTop: 5, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 4 },
  scopeText: { fontSize: 9.5, lineHeight: 12, fontWeight: "800" },

  textField: { position: "relative", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  textInput: {
    width: "100%",
    minHeight: 140,
    maxHeight: 220,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 26,
    fontSize: 14,
    lineHeight: 20,
  },
  counter: { position: "absolute", right: 10, bottom: 8, fontSize: 10.5, fontWeight: "700" },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  deleteButton: { width: 50, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  saveButton: { flex: 1, height: 50, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
