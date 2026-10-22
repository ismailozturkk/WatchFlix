import React, { memo, useCallback, useMemo } from "react";
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
  getAvatarSource,
} from "@utils/avatars";
import { buildAvatarChoices, sameAvatarChoice } from "@utils/avatarPhotos";
import { i18nText } from "@utils/i18nText";

const PROVIDER_ICON = {
  "google.com": "logo-google",
  "apple.com": "logo-apple",
};

function photoLabel(photoSource) {
  return photoSource === "google.com"
    ? i18nText("autoI18n.google_fotografi", "Google fotoğrafı")
    : i18nText("autoI18n.hesap_fotografi", "Hesap fotoğrafı");
}

const AvatarCell = memo(function AvatarCell({ item, selected, accent, onSelect }) {
  const isPhoto = item.avatarIndex === CUSTOM_AVATAR_INDEX;
  const avatarSource = getAvatarSource(item.avatarIndex, item.photoURL);

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
          ? photoLabel(item.photoSource)
          : i18nText("autoI18n.avatar_n", "Avatar {{n}}", { n: item.avatarIndex + 1 })
      }
    >
      <Image
        source={avatarSource}
        style={styles.avatar}
        contentFit="cover"
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
            {photoCount > 0
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

      {hasGooglePhoto ? (
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
