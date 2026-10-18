// components/person/FollowedPeopleSheet.js
//
// "Takip ettiklerim" alt sayfası: takip edilen oyuncu / yönetmenlerin listesi, kişinin sayfasına
// gitme ve takipten çıkarma. Film/Dizi sekmesindeki rafın (FollowedUpcomingRail) "Takip ettiklerim"
// bağından açılır. BottomSheetModal kabuğu (blur yerinde solar, sayfa kayar).
//
// Takipten çıkarma ONAYSIZ ve geri alınabilir: toast'ta "Geri Al" (kişi yeniden eklenir; takip
// zamanı yenilenir, listede en üste çıkar). Satır dokunuşu kişinin sayfasını açar ve sayfayı kapatır.
import React, { memo, useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { toast } from "../AppToast";
import BottomSheetModal from "../common/BottomSheetModal";
import GlassCloseButton from "../common/GlassCloseButton";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
import useFollowedPeople from "../../hooks/useFollowedPeople";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import { triggerHaptic } from "../../services/hapticsService";
import { MAX_FOLLOWED } from "../../utils/followedPeople";
import { departmentLabel, getFollowedPeopleCopy } from "../../utils/followedPeopleCopy";

const Row = memo(function Row({ person, copy, theme, getTmdbUrl, onOpen, onUnfollow }) {
  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <Pressable
        onPress={() => onOpen(person)}
        accessibilityRole="button"
        accessibilityLabel={copy.sheet.open(person.name)}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
      >
        {person.photo ? (
          <Image
            source={{ uri: getTmdbUrl(person.photo, "profile", 200) }}
            style={[styles.avatar, { backgroundColor: theme.primary }]}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty, { backgroundColor: theme.primary }]}>
            <Ionicons name="person" size={20} color={theme.text.muted} />
          </View>
        )}
        <View style={styles.rowText}>
          <Text style={[styles.name, { color: theme.text.primary }]} numberOfLines={1}>
            {person.name}
          </Text>
          <Text style={[styles.meta, { color: theme.text.muted }]} numberOfLines={1}>
            {departmentLabel(copy, person.department)}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => onUnfollow(person)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={copy.sheet.unfollowLabel(person.name)}
        style={({ pressed }) => [
          styles.unfollow,
          { backgroundColor: theme.primary, borderColor: theme.border },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="notifications-off-outline" size={16} color={theme.text.secondary} />
      </Pressable>
    </View>
  );
});

export default function FollowedPeopleSheet({ visible, onClose, navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { getTmdbUrl } = useImageQualitySettings();
  const copy = getFollowedPeopleCopy(language);
  const { people, count, follow, unfollow } = useFollowedPeople();

  const handleOpen = useCallback(
    (person) => {
      onClose?.();
      navigation?.navigate("ActorViewScreen", { personId: person.id });
    },
    [navigation, onClose],
  );

  const handleUnfollow = useCallback(
    (person) => {
      if (!unfollow(person.id)) return;
      triggerHaptic("selection");
      trackEvent(ANALYTICS_EVENTS.PERSON_FOLLOW, {
        action: "unfollow",
        source: "sheet",
        department: person.department || "other",
      });
      toast.undo(copy.toast.unfollowed(person.name), () => {
        follow({
          id: person.id,
          name: person.name,
          profile_path: person.photo,
          known_for_department: person.department,
        });
      });
    },
    [copy, follow, unfollow],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <Row
        person={item}
        copy={copy}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        onOpen={handleOpen}
        onUnfollow={handleUnfollow}
      />
    ),
    [copy, getTmdbUrl, handleOpen, handleUnfollow, theme],
  );

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={50}
      sheetStyle={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
            {copy.sheet.title}
          </Text>
          <Text allowFontScaling={false} style={[styles.count, { color: theme.text.muted }]}>
            {copy.sheet.count(count, MAX_FOLLOWED)}
          </Text>
        </View>
        <GlassCloseButton
          size={30}
          fallbackRadius={10}
          iconSize={15}
          onPress={onClose}
          accessibilityLabel={copy.sheet.close}
        />
      </View>
      <View style={[styles.separator, { backgroundColor: theme.border }]} />

      {people.length > 0 ? (
        <FlatList
          data={people}
          keyExtractor={(person) => String(person.id)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          style={styles.listBox}
        />
      ) : (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={36} color={theme.text.muted} />
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>{copy.sheet.empty}</Text>
          <Text style={[styles.emptyHint, { color: theme.text.muted }]}>{copy.sheet.emptyHint}</Text>
        </View>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: "82%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerText: { flexShrink: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: "700" },
  count: { fontSize: 12, fontWeight: "600" },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  listBox: { flexGrow: 0 },
  list: { gap: 8, paddingBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 8,
  },
  rowMain: { flexGrow: 1, flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flexShrink: 1, gap: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarEmpty: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 12 },
  unfollow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.75 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 28, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptyHint: { fontSize: 13, textAlign: "center", lineHeight: 19 },
});
