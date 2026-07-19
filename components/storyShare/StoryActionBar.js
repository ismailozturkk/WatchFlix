import React, { memo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";


function StoryActionBarComponent({ busy, onShare, onShareSticker, onOpenSettings, onSaveImage }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onShare}
        disabled={busy}
        style={[styles.shareBtn, { backgroundColor: theme.accent, opacity: busy ? 0.7 : 1 }]}
      >
        <View style={styles.glow} />
        <View style={styles.iconWrap}>
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="share-social" size={22} color="#fff" />
          )}
        </View>
        <View style={styles.copy}>
          <Text allowFontScaling={false} style={styles.title}>
            {busy ? i18nText("autoI18n.gorsel_hazirlaniyor", "Görsel hazırlanıyor") : i18nText("autoI18n.tasarimi_paylas", "Tasarımı Paylaş")}
          </Text>
          <Text allowFontScaling={false} style={styles.sub}>{i18nText("autoI18n.png_olarak_disa_aktar", "PNG olarak dışa aktar")}</Text>
        </View>
      </TouchableOpacity>

      {/* İçerikleri saydam zeminli PNG (çıkartma) olarak paylaş */}
      {onShareSticker && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onShareSticker}
          disabled={busy}
          style={[styles.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
        >
          <Ionicons name="cut-outline" size={22} color={theme.text.secondary} />
          <Text allowFontScaling={false} style={[styles.iconLabel, { color: theme.text.muted }]}>
            Sticker
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onSaveImage}
        disabled={busy}
        style={[styles.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
      >
        <Ionicons name="download-outline" size={22} color={theme.text.secondary} />
        <Text allowFontScaling={false} style={[styles.iconLabel, { color: theme.text.muted }]}>
          Galeri
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onOpenSettings}
        disabled={busy}
        style={[styles.iconBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
      >
        <Ionicons name="color-wand-outline" size={22} color={theme.accent} />
        <Text allowFontScaling={false} style={[styles.iconLabel, { color: theme.text.muted }]}>{i18nText("autoI18n.duzenle", "Düzenle")}</Text>
      </TouchableOpacity>
    </View>
  );
}

export const StoryActionBar = memo(StoryActionBarComponent);

const styles = StyleSheet.create({
  row: { width: "100%", flexDirection: "row", alignItems: "stretch", gap: 10 },
  shareBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 10,
  },
  glow: {
    position: "absolute",
    top: -24,
    right: -18,
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 2 },
  title: { color: "#fff", fontSize: 16, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.78)", fontSize: 11, fontWeight: "800" },
  iconBtn: {
    width: 60,
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  iconLabel: { fontSize: 10, fontWeight: "800" },
});
