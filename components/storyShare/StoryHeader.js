import React, { memo } from "react";
import {
  StyleSheet,
  Text,
  View,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlassIconButton from "../common/GlassIconButton";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";

function StoryHeaderComponent({ busy, onBack, onOpenDrafts, onSaveDraft }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  // Üst boşluk cihazın gerçek güvenli alanından gelir (çentik, Dynamic Island,
  // klasik 20pt durum çubuğu); sabit 56/40 küçük ekranda boşa yer yiyor,
  // büyük çentikte ise butonları durum çubuğunun altında bırakıyordu.
  const topInset = Math.max(
    insets.top,
    Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0
  );
  // Eski (cam yokken) kutu meşgulken yarı saydam kalır; cam yolunda opaklık
  // verilmez (fallbackStyle yalnız eski yolda uygulanır) — ikonlar soluklaşır.
  const fallbackBox = { backgroundColor: theme.secondary, opacity: busy ? 0.5 : 1 };
  const iconColor = busy ? theme.text.muted : theme.text.primary;
  return (
    <View style={[styles.header, { paddingTop: topInset + 8 }]}>
      {/* Ekran artık modal değil sayfa: kapat (X) yerine geri oku. */}
      <GlassIconButton
        icon="chevron-back"
        iconSize={22}
        size={40}
        fallbackRadius={12}
        color={iconColor}
        fallbackStyle={fallbackBox}
        accessibilityLabel={i18nText("autoI18n.geri", "Geri")}
        onPress={onBack}
      />
      <Text
        allowFontScaling={false}
        style={[styles.title, { color: theme.text.primary }]}
        numberOfLines={1}
      >
        {i18nText("autoI18n.story_tasarla", "Story Tasarla")}
      </Text>
      <View style={styles.right}>
        <GlassIconButton
          icon="folder-open-outline"
          iconSize={19}
          size={40}
          fallbackRadius={12}
          color={iconColor}
          fallbackStyle={fallbackBox}
          disabled={busy}
          accessibilityLabel={i18nText("autoI18n.taslaklar", "Taslaklar")}
          onPress={onOpenDrafts}
        />
        <GlassIconButton
          icon="save-outline"
          iconSize={19}
          size={40}
          fallbackRadius={12}
          color={busy ? theme.text.muted : theme.accent}
          fallbackStyle={fallbackBox}
          disabled={busy}
          accessibilityLabel={i18nText("autoI18n.kaydet", "Kaydet")}
          onPress={onSaveDraft}
        />
      </View>
    </View>
  );
}

export const StoryHeader = memo(StoryHeaderComponent);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: { flex: 1, minWidth: 0, fontSize: 17, fontWeight: "900" },
  right: { flexDirection: "row", gap: 10 },
});
