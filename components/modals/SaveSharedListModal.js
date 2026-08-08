// components/modals/SaveSharedListModal.js
//
// "Listeyi kaydet": feed'de paylaşılmış bir liste paylaşımını kullanıcının
// profiline YENİ bir özel liste olarak kopyalar.
//
// Kopya bağımsızdır: kaynak paylaşım silinse ya da düzenlense bile kaydedilen
// liste değişmez. Ortak/canlı liste isteyen kullanıcı için ayrı bir özellik
// (paylaşılan listeler, sharedListsService) zaten var; bu akış "beğendim,
// kendi listeme alayım" ihtiyacını karşılıyor.

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import BottomSheetModal from "@components/common/BottomSheetModal";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { useListStatusContext } from "@context/ListStatusContext";
import { useApiSettings, useImageQualitySettings } from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";
import {
  describeSaveTarget,
  MAX_LIST_NAME_LENGTH,
  MAX_SHARED_LIST_ITEMS,
  sharedListToItems,
} from "@utils/listShare";
import {
  formatMinutes,
  mergeFactsIntoList,
  pickFactTargets,
  sumListMinutes,
  todayListDate,
} from "@utils/mediaFacts";
import { buildGenreMap } from "@utils/genreLabels";
import { fetchMediaFactsBatch } from "@services/tmdbFacts";
import { saveSharedListToProfile } from "@services/listItemsService";

const PREVIEW_COUNT = 5;

export default function SaveSharedListModal({ visible, post, onClose, onSaved }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { allLists } = useListStatusContext();
  const { getTmdbUrl } = useImageQualitySettings();
  const { API_KEY } = useApiSettings();

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [facts, setFacts] = useState(null);
  const [hydrating, setHydrating] = useState(false);

  // ESKİ PAYLAŞIMLARI KURTARAN HALKA: süre/tür alanları hiç olmayan (bu
  // özellikten önce atılmış) bir paylaşım bile kaydedilirken TAM öğeye döner.
  // Gereken tek girdi id+type ve o her paylaşımda var — migration gerekmiyor.
  useEffect(() => {
    if (!visible || !API_KEY) return undefined;
    const targets = pickFactTargets(post?.mediaList || [], { limit: MAX_SHARED_LIST_ITEMS });
    if (targets.length === 0) return undefined;

    let alive = true;
    setHydrating(true);
    fetchMediaFactsBatch(targets, {
      apiKey: API_KEY,
      language,
      concurrency: 5,
      timeoutMs: 6000,
      isCancelled: () => !alive,
    })
      .then((resolved) => {
        if (alive) setFacts(resolved);
      })
      .finally(() => {
        if (alive) setHydrating(false);
      });

    return () => {
      alive = false;
    };
  }, [visible, post?.id, API_KEY, language]);

  const genreMap = useMemo(() => buildGenreMap(), [language]);

  const items = useMemo(
    () =>
      sharedListToItems(mergeFactsIntoList(post?.mediaList || [], facts), {
        // dateAdded BUGÜN: null kalırsa liste ekranındaki tarih filtreleri
        // öğeleri tamamen eliyor ve sıralama id'ye düşüyor.
        dateAdded: todayListDate(),
        genreMap,
      }),
    [post?.mediaList, facts, genreMap],
  );

  const durationLabels = useMemo(
    () => ({
      hourLabel: i18nText("autoI18n.saat_kisa_birim", "sa"),
      minuteLabel: i18nText("autoI18n.dakika_kisa_birim", "dk"),
    }),
    [language],
  );
  const totals = useMemo(() => sumListMinutes(items), [items]);
  // Çakışma denetimi için ekrandaki liste adları. Nihai karar sunucudaki
  // duruma göre işlem içinde veriliyor; buradaki yalnız önizleme.
  const existingNames = useMemo(() => Object.keys(allLists || {}), [allLists]);
  const target = useMemo(
    () => describeSaveTarget(name, existingNames, items.length),
    [name, existingNames, items.length],
  );
  // Oturum yoksa yazacak yer de yok; buton hiç etkin olmasın (aksi halde
  // dokunuş sessizce hiçbir şey yapardı).
  const canSave = target.canSave && !!user?.uid;

  useEffect(() => {
    if (visible) return undefined;
    // Kapanışta tazele: bir sonraki paylaşım eskisinin olgularını görmesin.
    setFacts(null);
    setHydrating(false);
    return undefined;
  }, [visible]);

  useEffect(() => {
    if (visible) setName((post?.title || "").slice(0, MAX_LIST_NAME_LENGTH));
  }, [visible, post?.title]);

  const handleSave = async () => {
    if (saving || !canSave) return;
    setSaving(true);
    try {
      const savedName = await saveSharedListToProfile(user.uid, name, items, {
        postId: post?.id,
      });
      if (!savedName) throw new Error("liste adı çözülemedi");
      Toast.show({
        type: "success",
        text1: i18nText("autoI18n.liste_profiline_eklendi", "Liste profiline eklendi"),
        text2: `${savedName} · ${items.length}`,
      });
      onSaved?.(savedName);
      onClose?.();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: i18nText("autoI18n.liste_kaydedilemedi", "Liste kaydedilemedi"),
      });
    } finally {
      setSaving(false);
    }
  };

  const dropped = (post?.mediaList?.length || 0) - items.length;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.35)"
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.secondary, borderColor: theme.border },
      ]}
    >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={styles.header}>
            <View
              style={[styles.iconWrap, { backgroundColor: `${theme.accent}22` }]}
            >
              <Ionicons name="albums" size={18} color={theme.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.title, { color: theme.text.primary }]}>
                {i18nText("autoI18n.listeyi_kaydet", "Listeyi kaydet")}
              </Text>
              <Text style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={2}>
                {i18nText(
                  "autoI18n.listeyi_kaydet_aciklama",
                  "Bu liste profilinde yeni bir liste olarak oluşturulur.",
                )}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="close" size={19} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          {items.length > 0 && (
            <View style={styles.posterRow}>
              {items.slice(0, PREVIEW_COUNT).map((item) => (
                <View
                  key={`${item.type}_${item.id}`}
                  style={[styles.poster, { backgroundColor: theme.border }]}
                >
                  {item.imagePath ? (
                    <Image
                      source={{ uri: getTmdbUrl(item.imagePath, "poster", 200) }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name="film-outline" size={16} color={theme.text.muted} />
                  )}
                </View>
              ))}
              {items.length > PREVIEW_COUNT && (
                <View
                  style={[
                    styles.poster,
                    styles.posterMore,
                    { backgroundColor: theme.primary, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.posterMoreText, { color: theme.text.secondary }]}>
                    +{items.length - PREVIEW_COUNT}
                  </Text>
                </View>
              )}
            </View>
          )}

          <Text style={[styles.label, { color: theme.text.muted }]}>
            {i18nText("autoI18n.liste_adi_baslik", "LİSTE ADI")}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={MAX_LIST_NAME_LENGTH}
            placeholder={i18nText("autoI18n.liste_adi_gir", "Liste adı gir")}
            placeholderTextColor={theme.text.muted}
            style={[
              styles.input,
              {
                color: theme.text.primary,
                backgroundColor: theme.primary,
                borderColor: theme.border,
              },
            ]}
          />

          <View style={styles.noteRow}>
            <Ionicons
              name="information-circle-outline"
              size={13}
              color={theme.text.muted}
            />
            <Text style={[styles.note, { color: theme.text.muted }]}>
              {items.length}{" "}
              {i18nText("autoI18n.icerik_kaydedilecek", "içerik kaydedilecek")}
              {dropped > 0
                ? ` · ${i18nText("autoI18n.liste_tavani_asildi", "ilk {{count}} içerik alındı", { count: MAX_SHARED_LIST_ITEMS })}`
                : ""}
              {/* Süre yalnız BİLİNİYORSA yazılır; "0 dk" yanlış bilgi olurdu. */}
              {totals.known > 0
                ? ` · ${totals.unknown > 0 ? `${i18nText("autoI18n.en_az", "en az")} ` : ""}${formatMinutes(totals.total, durationLabels)}`
                : ""}
            </Text>
            {hydrating && <ActivityIndicator size="small" color={theme.text.muted} />}
          </View>

          {/* Yarım veriyi tam gibi göstermemek için: kaç öğenin süresi hâlâ
              bilinmiyor, açıkça söylenir. */}
          {totals.unknown > 0 && !hydrating && (
            <View style={styles.noteRow}>
              <Ionicons name="help-circle-outline" size={13} color={theme.text.muted} />
              <Text style={[styles.note, { color: theme.text.muted }]}>
                {i18nText("autoI18n.sure_bilinmiyor", "{{count}} içeriğin süresi bilinmiyor", {
                  count: totals.unknown,
                })}
              </Text>
            </View>
          )}

          {/* Sessizce yeniden adlandırmak sürpriz olurdu: ad doluysa hangi
              adla kaydedileceği KAYDETMEDEN önce söyleniyor. */}
          {target.renamed && (
            <View style={styles.noteRow}>
              <Ionicons name="git-branch-outline" size={13} color={theme.accent} />
              <Text style={[styles.note, { color: theme.accent }]} numberOfLines={2}>
                {i18nText("autoI18n.ayni_isimde_liste_var", "Bu isimde liste var, şöyle kaydedilecek:")}{" "}
                {target.resolvedName}
              </Text>
            </View>
          )}

          <TouchableOpacity
            disabled={!canSave || saving}
            onPress={handleSave}
            activeOpacity={0.85}
            style={[
              styles.saveBtn,
              {
                backgroundColor: theme.accent,
                opacity: !canSave || saving ? 0.5 : 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="download-outline" size={17} color="#fff" />
            )}
            <Text style={styles.saveText}>
              {i18nText("autoI18n.profilime_ekle", "Profilime ekle")}
            </Text>
          </TouchableOpacity>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 26,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "900" },
  subtitle: { fontSize: 11.5, lineHeight: 16, marginTop: 3 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  posterRow: { flexDirection: "row", gap: 6, marginTop: 16 },
  poster: {
    width: 42,
    height: 60,
    borderRadius: 9,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  posterMore: { borderWidth: StyleSheet.hairlineWidth },
  posterMoreText: { fontSize: 11, fontWeight: "800" },
  label: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  input: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  note: { flex: 1, fontSize: 11, fontWeight: "600", lineHeight: 15 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    marginTop: 18,
  },
  saveText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
