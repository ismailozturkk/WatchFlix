// components/chat/ChatEmptyState.js
//
// Hiç mesajı olmayan sohbetin ortasında duran "Sohbete başla" kartı: büyük
// avatar, başlık, kısa açıklama ve tek dokunuşla gönderilen hazır ilk mesaj
// önerileri. Birebir ve grup sohbeti aynı bileşeni kullanır (isGroup).
//
// Mesaj listesinin ÜSTÜNDE mutlak katman olarak çizilir (ters FlatList'in
// ListEmptyComponent'i bazı RN sürümlerinde baş aşağı çıkıyordu); üst/alt
// boşluk şeritler ve yazı kutusu kadar verilir ki kart onların altında kalmasın.
import React, { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Reanimated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useTheme } from "@context/ThemeContext";
import { alpha } from "../../theme/colors";
import { i18nText } from "@utils/i18nText";
import GlassTouchable from "../common/GlassTouchable";

function buildSuggestions(isGroup) {
  return isGroup
    ? [
        i18nText("autoI18n.sohbet_bos_oneri_grup_1", "👋 Selam herkese!"),
        i18nText("autoI18n.sohbet_bos_oneri_grup_2", "🍿 Bu hafta ne izliyoruz?"),
        i18nText("autoI18n.sohbet_bos_oneri_grup_3", "🎬 Film önerisi olan var mı?"),
      ]
    : [
        i18nText("autoI18n.sohbet_bos_oneri_1", "👋 Merhaba!"),
        i18nText("autoI18n.sohbet_bos_oneri_2", "🎬 En son ne izledin?"),
        i18nText("autoI18n.sohbet_bos_oneri_3", "🍿 Bu akşam birlikte ne izlesek?"),
      ];
}

function ChatEmptyState({ avatar, name, isGroup, reduceMotion, onSuggestion, style }) {
  const { theme } = useTheme();
  const suggestions = useMemo(() => buildSuggestions(isGroup), [isGroup]);

  const subtitle = isGroup
    ? i18nText(
        "autoI18n.sohbet_bos_alt_grup",
        "Grupta henüz mesaj yok. Sohbeti sen başlat!",
      )
    : name
      ? i18nText(
          "autoI18n.sohbet_bos_alt_kisi",
          `${name} ile henüz mesajlaşmadınız. İlk mesajı sen gönder!`,
          { name },
        )
      : i18nText(
          "autoI18n.sohbet_bos_alt",
          "Henüz mesaj yok. İlk mesajı sen gönder!",
        );

  const enter = (delay) =>
    reduceMotion ? undefined : FadeInDown.duration(320).delay(delay);

  return (
    <View style={[styles.layer, style]} pointerEvents="box-none">
      <Reanimated.View
        entering={reduceMotion ? undefined : FadeIn.duration(260)}
        style={styles.card}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.avatarRing,
            {
              borderColor: alpha(theme.accent, 0.35),
              backgroundColor: alpha(theme.accent, 0.08),
            },
          ]}
        >
          {avatar}
        </View>

        <Reanimated.Text
          entering={enter(60)}
          style={[styles.title, { color: theme.text.primary }]}
        >
          {i18nText("autoI18n.sohbet_bos_baslik", "Mesajlaşmaya başla")}
        </Reanimated.Text>
        <Reanimated.Text
          entering={enter(110)}
          style={[styles.subtitle, { color: theme.text.muted }]}
        >
          {subtitle}
        </Reanimated.Text>

        <View style={styles.chips} pointerEvents="box-none">
          {suggestions.map((label, index) => (
            <Reanimated.View key={label} entering={enter(170 + index * 60)}>
              <GlassTouchable
                onPress={() => onSuggestion?.(label)}
                activeOpacity={0.8}
                style={[
                  styles.chip,
                  {
                    backgroundColor: alpha(theme.secondary, 0.78),
                    borderColor: theme.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint={i18nText(
                  "autoI18n.sohbet_bos_oneri_ipucu",
                  "Bu mesajı gönderir",
                )}
              >
                <Text style={[styles.chipText, { color: theme.text.primary }]} numberOfLines={1}>
                  {label}
                </Text>
              </GlassTouchable>
            </Reanimated.View>
          ))}
        </View>
      </Reanimated.View>
    </View>
  );
}

export default memo(ChatEmptyState);

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    zIndex: 4,
  },
  card: {
    alignItems: "center",
    maxWidth: 340,
    width: "100%",
  },
  avatarRing: {
    padding: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  chips: {
    alignItems: "center",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
