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
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useUserProfile } from "@context/UserProfileContext";
import { AVATARS, CUSTOM_AVATAR_INDEX, getAvatarSource } from "@utils/avatars";
import { i18nText } from "@utils/i18nText";

const RAW_AVATAR_INDEXES = AVATARS.map((_, index) => index);

const AvatarCell = memo(function AvatarCell({
  index,
  selected,
  accent,
  photoURL,
  onSelect,
}) {
  const isSocial = index === CUSTOM_AVATAR_INDEX;
  const avatarSource = isSocial
    ? getAvatarSource(CUSTOM_AVATAR_INDEX, photoURL)
    : getAvatarSource(index);

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={() => onSelect(index)}
      style={[
        styles.cell,
        selected && { borderColor: accent, backgroundColor: accent + "18" },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={
        isSocial
          ? i18nText("autoI18n.sosyal_profil_fotografi", "Sosyal Profil Fotoğrafı")
          : i18nText("autoI18n.avatar_n", "Avatar {{n}}", { n: index + 1 })
      }
    >
      <Image
        source={avatarSource}
        style={styles.avatar}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={String(index)}
      />

      {isSocial && (
        <View style={[styles.socialBadge, { backgroundColor: accent }]}>
          <Ionicons name="sparkles" size={8} color="#fff" />
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

export default function ProfileAvatarPickerModal({
  visible,
  selectedIndex,
  saving,
  onSelect,
  onClose,
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const insets = useSafeAreaInsets();

  const socialPhotoURL = profile?.photoURL || user?.photoURL || null;

  const avatarIndexes = useMemo(() => {
    if (socialPhotoURL) {
      return [CUSTOM_AVATAR_INDEX, ...RAW_AVATAR_INDEXES];
    }
    return RAW_AVATAR_INDEXES;
  }, [socialPhotoURL]);

  const chooseAvatar = useCallback(
    (index) => {
      Promise.resolve(onSelect(index)).catch(() => {});
    },
    [onSelect]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <AvatarCell
        index={item}
        selected={item === selectedIndex}
        accent={theme.accent}
        photoURL={socialPhotoURL}
        onSelect={chooseAvatar}
      />
    ),
    [selectedIndex, theme.accent, socialPhotoURL, chooseAvatar]
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
            {socialPhotoURL
              ? i18nText("autoI18n.profil_fotografi_ve_n_avatar", "Profil fotoğrafın ve {{n}} avatar", {
                  n: RAW_AVATAR_INDEXES.length,
                })
              : i18nText("autoI18n.n_avatar", "{{n}} avatar", {
                  n: RAW_AVATAR_INDEXES.length,
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

      <FlatList
        data={avatarIndexes}
        extraData={selectedIndex}
        keyExtractor={(item) => String(item)}
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
