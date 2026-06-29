import React, { memo, useCallback } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ICON_BACKGROUND_IMAGES } from "@components/IconBacground";
import { i18nText } from "@utils/i18nText";
import GroupAvatar from "@components/chat/GroupAvatar";

const AVATAR_INDEXES = ICON_BACKGROUND_IMAGES.map((_, index) => index);

const AvatarCell = memo(function AvatarCell({
  index,
  selected,
  color,
  onSelect,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onSelect(index)}
      style={[
        styles.cell,
        selected && { borderColor: color, backgroundColor: color + "18" },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={i18nText(
        "autoI18n.grup_avatari_n",
        "Grup avatarı {{n}}",
        { n: index + 1 }
      )}
    >
      <GroupAvatar avatarIndex={index} size={40} iconSize={28} />
      {selected && (
        <View style={[styles.check, { backgroundColor: color }]}>
          <Ionicons name="checkmark" size={10} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
});

const GroupAvatarGrid = memo(function GroupAvatarGrid({
  selectedIndex,
  color = "#6C63FF",
  onSelect,
  style,
}) {
  const renderItem = useCallback(
    ({ item }) => (
      <AvatarCell
        index={item}
        selected={item === selectedIndex}
        color={color}
        onSelect={onSelect}
      />
    ),
    [selectedIndex, color, onSelect]
  );

  return (
    <FlatList
      data={AVATAR_INDEXES}
      extraData={selectedIndex}
      keyExtractor={(item) => String(item)}
      renderItem={renderItem}
      numColumns={6}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      style={style}
      showsVerticalScrollIndicator={false}
      initialNumToRender={30}
      maxToRenderPerBatch={24}
      updateCellsBatchingPeriod={40}
      windowSize={5}
      removeClippedSubviews={Platform.OS === "android"}
    />
  );
});

export const GROUP_AVATAR_COUNT = AVATAR_INDEXES.length;
export default GroupAvatarGrid;

const styles = StyleSheet.create({
  grid: { paddingTop: 2, paddingBottom: 12 },
  row: { justifyContent: "space-between" },
  cell: {
    width: "15.2%",
    aspectRatio: 1,
    marginBottom: 7,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
});
