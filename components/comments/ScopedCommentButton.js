// components/comments/ScopedCommentButton.js
//
// Sezon / bölüm sayfalarındaki "Yorumlar" butonu. Dizinin ORTAK yorum
// sayfasını açar ama filtre ve yazma hedefi bulunulan kısma ayarlıdır —
// yorumlar hâlâ tek yerde toplanır, kullanıcı yalnız o kısmı görür.

import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import CommentSheetModal from "../modals/CommentSheetModal";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { normalizeScope } from "../../utils/commentScope";
import { scopeLong } from "./scopeTexts";

export default function ScopedCommentButton({
  theme,
  showId,
  showName,
  showPosterPath,
  scope,
  // Sezon sayısı biliniyorsa kapsam seçici tüm sezonları listeler; bilinmiyorsa
  // en azından bulunulan sezon görünür (bölümler TMDB'den açılınca çekilir).
  seasonCount = 0,
  style,
}) {
  const [visible, setVisible] = useState(false);
  const normalized = useMemo(() => normalizeScope(scope), [scope]);

  const seasons = useMemo(() => {
    const map = new Map();
    for (let i = 1; i <= Number(seasonCount || 0); i += 1) {
      map.set(i, { season_number: i, name: "", episode_count: 0 });
    }
    if (normalized.seasonNumber != null && !map.has(normalized.seasonNumber)) {
      map.set(normalized.seasonNumber, {
        season_number: normalized.seasonNumber,
        name: "",
        episode_count: 0,
      });
    }
    return [...map.values()].sort((a, b) => a.season_number - b.season_number);
  }, [seasonCount, normalized.seasonNumber]);

  const details = useMemo(
    () => ({ name: showName || "", poster_path: showPosterPath || null }),
    [showName, showPosterPath],
  );

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setVisible(true)}
        style={[
          styles.button,
          {
            borderColor: alpha(theme.accent, 0.45),
            backgroundColor: alpha(theme.accent, 0.12),
          },
          style,
        ]}
      >
        <Ionicons name="chatbubble-ellipses" size={15} color={theme.accent} />
        <View style={styles.textGroup}>
          <Text
            allowFontScaling={false}
            style={[styles.title, { color: theme.text?.primary ?? "#fff" }]}
          >
            {i18nText("comments", "Yorumlar")}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.subtitle, { color: theme.text?.muted ?? "#888" }]}
          >
            {scopeLong(normalized)}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={15}
          color={theme.text?.muted ?? "#888"}
        />
      </TouchableOpacity>

      <Modal
        animationType="none"
        transparent
        visible={visible}
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
      >
        <CommentSheetModal
          visible={visible}
          onClose={() => setVisible(false)}
          movieId={showId}
          details={details}
          collectionName="TvComment"
          seasons={seasons}
          initialScope={normalized}
          subtitle={scopeLong(normalized)}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  textGroup: { flex: 1, minWidth: 0 },
  title: { fontSize: 13.5, fontWeight: "800" },
  subtitle: { fontSize: 11, marginTop: 1 },
});
