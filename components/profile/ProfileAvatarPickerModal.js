import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheetModal from "@components/common/BottomSheetModal";
import GlassCloseButton from "@components/common/GlassCloseButton";
import GlassTouchable from "@components/common/GlassTouchable";
import { useTheme } from "@context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { useProfileUi } from "@context/ProfileUiContext";
import {
  AVATARS,
  AVATAR_COUNT,
  CUSTOM_AVATAR_INDEX,
  avatarContentPosition,
  avatarRenderPx,
  getAvatarSource,
} from "@utils/avatars";
import {
  buildAvatarChoices,
  isPersonPhotoSource,
  PERSON_PHOTO_SOURCE,
  sameAvatarChoice,
} from "@utils/avatarPhotos";
import { OWN_PHOTO_CHECK_TTL_MS } from "@utils/photoRevalidation";
import { i18nText } from "@utils/i18nText";
import useFreshPhotoSource from "../../hooks/useFreshPhotoSource";
import PersonAvatarPanel from "./PersonAvatarPanel";

const PROVIDER_ICON = {
  "google.com": "logo-google",
  "apple.com": "logo-apple",
  [PERSON_PHOTO_SOURCE]: "film",
};

// Seçicinin iki sekmesi: hazır avatarlar + bağlı hesap fotoğrafları |
// oyuncu/yönetmen fotoğrafları (TMDB).
const TABS = ["avatars", "people"];
// Izgara hücresi ~70 pt (5 sütun): kişi fotoğrafında küçük kopya yeter.
const CELL_PX = avatarRenderPx(72);

function photoLabel(item) {
  if (isPersonPhotoSource(item.photoSource)) {
    return item.photoPerson?.name
      ? i18nText("autoI18n.avatar_kisi_etiketi", "{{name}} fotoğrafı", { name: item.photoPerson.name })
      : i18nText("autoI18n.avatar_kisi_fotografi", "Oyuncu fotoğrafı");
  }
  return item.photoSource === "google.com"
    ? i18nText("autoI18n.google_fotografi", "Google fotoğrafı")
    : i18nText("autoI18n.hesap_fotografi", "Hesap fotoğrafı");
}

const AvatarCell = memo(function AvatarCell({ item, selected, accent, onSelect }) {
  const isPhoto = item.avatarIndex === CUSTOM_AVATAR_INDEX;
  // Bağlı hesap fotoğrafları kullanıcının kendisinin: seçici açılınca kısa
  // aralıkla denetlenir (Google'da değişen resim aynı adresten gelir).
  const avatarSource = useFreshPhotoSource(
    getAvatarSource(item.avatarIndex, item.photoURL, CELL_PX),
    isPhoto ? { maxAgeMs: OWN_PHOTO_CHECK_TTL_MS, priority: true } : undefined,
  );

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={() => onSelect(item)}
      style={[
        styles.cell,
        selected && { borderColor: accent, backgroundColor: accent + "18" },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={
        isPhoto
          ? photoLabel(item)
          : i18nText("autoI18n.avatar_n", "Avatar {{n}}", { n: item.avatarIndex + 1 })
      }
    >
      <Image
        source={avatarSource}
        style={styles.avatar}
        contentFit="cover"
        contentPosition={avatarContentPosition(avatarSource)}
        cachePolicy="memory-disk"
        recyclingKey={item.key}
        // Süresi dolmuş sağlayıcı adresi boş hücre bırakmasın.
        placeholder={isPhoto ? AVATARS[0] : undefined}
      />

      {isPhoto && (
        <View style={[styles.socialBadge, { backgroundColor: accent }]}>
          <Ionicons
            name={PROVIDER_ICON[item.photoSource] || "sparkles"}
            size={8}
            color="#fff"
          />
        </View>
      )}

      {selected && (
        <View style={[styles.check, { backgroundColor: accent }]}>
          <Ionicons name="checkmark" size={11} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
});

/**
 * Avatar seçici: bağlı hesap fotoğrafları (Google…) + hazır avatarlar.
 *
 * @param {object}   props.selected  Seçili avatar: { avatarIndex, photoURL, photoSource }
 *   (utils/avatarPhotos.js). Verilmezse kendi kayıtlı avatarın kullanılır.
 * @param {Function} props.onSelect  Seçim NESNESİYLE çağrılır; çağıran
 *   ProfileUiContext.selectAvatar'a ya da forma iletir.
 */
export default function ProfileAvatarPickerModal({
  visible,
  selected,
  saving,
  onSelect,
  onClose,
}) {
  const { theme } = useTheme();
  const { myAvatar, linkedPhotos } = useProfileUi();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const current = selected || myAvatar;
  // Açılışta seçili avatarın sekmesi: kişi fotoğrafıysa "Oyuncu & Yönetmen".
  const tabFor = (choice) => (isPersonPhotoSource(choice?.photoSource) ? "people" : "avatars");
  const [tab, setTab] = useState(() => tabFor(current));
  useEffect(() => {
    if (visible) setTab(tabFor(current));
    // Yalnız açılışta; açıkken seçim değişince sekme zıplamasın.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const choices = useMemo(
    () => buildAvatarChoices({ linkedPhotos, current }),
    [linkedPhotos, current]
  );
  const photoCount = choices.length - AVATAR_COUNT;
  const hasGooglePhoto = linkedPhotos.some((p) => p.providerId === "google.com");

  const chooseAvatar = useCallback(
    (item) => {
      Promise.resolve(onSelect(item)).catch(() => {});
    },
    [onSelect]
  );

  const openConnections = useCallback(() => {
    onClose?.();
    navigation.navigate("AccountConnectionsScreen");
  }, [navigation, onClose]);

  const renderItem = useCallback(
    ({ item }) => (
      <AvatarCell
        item={item}
        selected={sameAvatarChoice(item, current)}
        accent={theme.accent}
        onSelect={chooseAvatar}
      />
    ),
    [current, theme.accent, chooseAvatar]
  );

  return (
    <BottomSheetModal
      visible={visible}
      // Kaydederken dışarı dokunuşla kapanmasın; kapatma düğmesi de pasif.
      onClose={saving ? () => {} : onClose}
      dismissOnBackdropPress={!saving}
      intensity={35}
      dimColor="rgba(0,0,0,0.45)"
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 18),
        },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <View style={styles.header}>
        <View
          style={[
            styles.headerIcon,
            { backgroundColor: theme.accent + "1F" },
          ]}
        >
          <Ionicons
            name="person-circle-outline"
            size={20}
            color={theme.accent}
          />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            {i18nText("autoI18n.avatar_sec", "Avatar seç")}
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.muted }]}>
            {tab === "people"
              ? i18nText("autoI18n.avatar_kisi_altbaslik", "Oyuncu ve yönetmen fotoğrafları")
              : photoCount > 0
                ? i18nText("autoI18n.profil_fotografi_ve_n_avatar", "Profil fotoğrafın ve {{n}} avatar", {
                    n: AVATAR_COUNT,
                  })
                : i18nText("autoI18n.n_avatar", "{{n}} avatar", {
                    n: AVATAR_COUNT,
                  })}
          </Text>
        </View>
        <GlassCloseButton
          size={35}
          fallbackRadius={18}
          iconSize={20}
          color={theme.text.primary}
          disabled={saving}
          onPress={onClose}
        />
      </View>

      <View style={[styles.tabs, { backgroundColor: theme.primary, borderColor: theme.border }]}>
        {TABS.map((id) => {
          const active = tab === id;
          return (
            <GlassTouchable
              key={id}
              activeOpacity={0.8}
              onPress={() => setTab(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && { backgroundColor: theme.accent }]}
            >
              <Ionicons
                name={id === "people" ? "film-outline" : "happy-outline"}
                size={14}
                color={active ? "#fff" : theme.text.secondary}
              />
              <Text
                numberOfLines={1}
                style={[styles.tabText, { color: active ? "#fff" : theme.text.secondary }]}
              >
                {id === "people"
                  ? i18nText("autoI18n.avatar_sekme_oyuncular", "Oyuncu & Yönetmen")
                  : i18nText("autoI18n.avatar_sekme_avatarlar", "Avatarlar")}
              </Text>
            </GlassTouchable>
          );
        })}
      </View>

      {tab === "people" ? (
        <PersonAvatarPanel current={current} onSelect={chooseAvatar} disabled={saving} />
      ) : null}

      {tab !== "avatars" ? null : hasGooglePhoto ? (
        <View style={[styles.hint, { backgroundColor: theme.accent + "12" }]}>
          <Ionicons name="sync-outline" size={14} color={theme.accent} />
          <Text style={[styles.hintText, { color: theme.text.secondary }]}>
            {i18nText(
              "autoI18n.avatar_foto_guncel_kalir",
              "Google'da fotoğrafını değiştirirsen burada da güncellenir"
            )}
          </Text>
        </View>
      ) : linkedPhotos.length === 0 ? (
        <GlassTouchable
          activeOpacity={0.75}
          disabled={saving}
          onPress={openConnections}
          accessibilityRole="link"
          style={[styles.hint, { backgroundColor: theme.accent + "12" }]}
        >
          <Ionicons name="logo-google" size={14} color={theme.accent} />
          <Text style={[styles.hintText, { color: theme.text.secondary }]}>
            {i18nText(
              "autoI18n.avatar_foto_ipucu",
              "Google hesabını bağlarsan fotoğrafını da avatar yapabilirsin"
            )}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.text.muted} />
        </GlassTouchable>
      ) : null}

      {tab === "avatars" ? (
      <FlatList
        data={choices}
        extraData={current}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        numColumns={5}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={15}
        updateCellsBatchingPeriod={40}
        windowSize={4}
        removeClippedSubviews={Platform.OS === "android"}
      />
      ) : null}

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.savingText, { color: theme.text.primary }]}>
            {i18nText("autoI18n.kaydediliyor", "Kaydediliyor...")}
          </Text>
        </View>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    height: "72%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 13,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  grid: { paddingTop: 2, paddingBottom: 10 },
  row: { justifyContent: "space-between" },
  cell: {
    width: "18.6%",
    aspectRatio: 1,
    marginBottom: 9,
    padding: 3,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: "100%", height: "100%", borderRadius: 12 },
  socialBadge: {
    position: "absolute",
    top: 2,
    left: 2,
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
    zIndex: 2,
  },
  check: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
    zIndex: 2,
  },
  tabs: {
    flexDirection: "row",
    gap: 4,
    padding: 3,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 34,
    borderRadius: 11,
  },
  tabText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1 },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    marginBottom: 12,
  },
  hintText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 16 },
  savingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "rgba(8,8,14,0.62)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  savingText: { fontSize: 12.5, fontWeight: "700" },
});
