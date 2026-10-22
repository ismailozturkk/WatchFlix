// components/game/QuickGamesGrid.js
//
// Eğlence'deki Oyunlar modülünün "Hızlı oyunlar" ızgarası: "Önce hangisi?" + utils/quickGames.js'teki dört oyun.
// İki sütun; tek kalan son kare tam genişlikte. Her kare oyunun adını ve rekorunu (ya da "Yeni") gösterir,
// dokununca oyun açılır.
//
// Premium kapısı YOK ve modülün kilit şeridinden bağımsızdır (Sahne Tahmin kilitliyken de oynanır): oyunlar yerel,
// sunucu maliyeti yok, deneme kapısı olarak çalışır. Kilitlemek istenirse `onOpen`i modülün `guarded`ına sar.

import React, { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import { PressableScale, SectionHeader } from "@components/game/ui";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { Keys, useStored } from "@services/storage";
import { normalizeOlderStats } from "@utils/olderGame";
import { getOlderCopy } from "@utils/olderGameCopy";
import { QUICK_GAME_IDS, QUICK_GAME_META, normalizeQuickStats } from "@utils/quickGames";
import { getQuickCopy } from "@utils/quickGamesCopy";

const GOLD = "#FFD76A";

/** "Önce hangisi?" bu ailenin ilk üyesi; kendi rotası ve kayıt anahtarı var. */
const OLDER_TILE = { id: "older", icon: "swap-horizontal", colors: ["#6366F1", "#4338CA"] };

function QuickGamesGrid({ theme, onOpen }) {
  const { language } = useLanguage();
  const { user } = useAuth() || {};
  const uid = user?.uid || null;
  const copy = getOlderCopy(language); // ortak metinler + "Önce hangisi?" başlığı
  const quick = getQuickCopy(language);

  const olderRaw = useStored(Keys.olderGame, { uid });
  const quickRaw = useStored(Keys.quickGames, { uid });
  const bests = useMemo(() => {
    const all = normalizeQuickStats(quickRaw);
    const map = { older: normalizeOlderStats(olderRaw).best };
    QUICK_GAME_IDS.forEach((id) => { map[id] = all[id]?.best || 0; });
    return map;
  }, [olderRaw, quickRaw]);

  const tiles = [
    { ...OLDER_TILE, title: copy.title },
    ...QUICK_GAME_IDS.map((id) => ({
      id,
      icon: QUICK_GAME_META[id].icon,
      colors: QUICK_GAME_META[id].colors,
      title: quick.games[id].title,
    })),
  ];

  return (
    <View style={styles.wrap}>
      <SectionHeader title={quick.gridTitle} theme={theme} style={styles.header} />
      <View style={styles.grid}>
        {tiles.map((tile, index) => {
          const best = bests[tile.id] || 0;
          const last = index === tiles.length - 1 && tiles.length % 2 === 1;
          return (
            <PressableScale
              key={tile.id}
              accessibilityRole="button"
              accessibilityLabel={tile.title}
              onPress={() => onOpen(tile.id)}
              scaleTo={0.97}
              style={[styles.tileWrap, last && styles.tileWide, { shadowColor: tile.colors[1] }]}
            >
              <LinearGradient colors={tile.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
                <View pointerEvents="none" style={styles.glow} />
                <View style={styles.icon}>
                  <AppIcon family="Ionicons" name={tile.icon} size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.title} numberOfLines={2} allowFontScaling={false}>
                  {tile.title}
                </Text>
                <View style={styles.meta}>
                  <AppIcon family="Ionicons" name={best > 0 ? "trophy" : "sparkles"} size={12} color={best > 0 ? GOLD : "#FFFFFF"} />
                  <Text style={styles.metaText} numberOfLines={1} allowFontScaling={false}>
                    {best > 0 ? copy.cardBest(best) : copy.cardNew}
                  </Text>
                </View>
              </LinearGradient>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

export default memo(QuickGamesGrid);

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  header: { marginTop: 4, marginBottom: 8, paddingHorizontal: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tileWrap: {
    flexGrow: 1,
    flexBasis: "47%",
    borderRadius: 20,
    elevation: 5,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 9,
  },
  tileWide: { flexBasis: "100%" },
  tile: { minHeight: 104, borderRadius: 20, padding: 12, overflow: "hidden", justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  glow: { position: "absolute", width: 110, height: 110, borderRadius: 55, right: -40, top: -50, backgroundColor: "rgba(255,255,255,0.14)" },
  icon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.22)" },
  title: { color: "#FFFFFF", fontSize: 14.5, lineHeight: 18, fontWeight: "900", letterSpacing: -0.2, marginTop: 10 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  metaText: { color: "rgba(255,255,255,0.92)", fontSize: 11.5, fontWeight: "800" },
});
