import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import SeasonItem from "./SeasonItem";
import { i18nText } from "../../utils/i18nText";

/**
 * Sezon carousel'i — 5'ten fazla sezonu olan dizilerde kullanılır.
 * Sezonlar tek tek, tam genişlik sayfalar hâlinde gösterilir; sağa/sola
 * kaydırma FlatList'in NATIVE paging'iyle çalışır. PanResponder yok →
 * sayfanın dikey kaydırmasıyla çakışma ve kart takası kare-senkron
 * sorunları kökten ortadan kalkar (önceki yığın denemesinin sorunlarıydı).
 *
 * Props:
 *  - seasons         : season_number > 0 filtreli sezon listesi
 *  - details         : dizi detayı (SeasonItem'a geçer)
 *  - navigation
 *  - getWatchedCount : (seasonNumber) => izlenen bölüm sayısı
 *  - getWatchEvents  : (seasonNumber) => izleme kayıtları (SeasonItem'daki
 *                      izleme geçmişi sayfası bunlarla dolar; geçilmezse
 *                      kullanıcı kaydını göremez ve silemez)
 *  - theme
 */
// Komşu sayfalar arasındaki görünür boşluk = 2×GUTTER. Kapsayıcı kenarlara
// -GUTTER taşar, her sayfa GUTTER iç dolgu alır → durağan kart bölümle aynı
// hizada kalır, kaydırma sırasında kartlar bitişik görünmez.
const GUTTER = 8;

export default function SeasonDeck({
  seasons,
  details,
  navigation,
  getWatchedCount,
  getWatchEvents,
  theme,
}) {
  const [index, setIndex] = useState(0);
  // Sayfa genişliği ölçümle alınır — bölüm hangi yatay dolgu içinde olursa
  // olsun sayfalar konteynere birebir oturur.
  const [pageW, setPageW] = useState(0);

  const n = seasons.length;
  if (n === 0) return null;

  return (
    <View>
      <View
        style={{ marginHorizontal: -GUTTER }}
        onLayout={(e) => setPageW(e.nativeEvent.layout.width)}
      >
        {pageW > 0 && (
          <FlatList
            data={seasons}
            keyExtractor={(s) => String(s.id)}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            getItemLayout={(_, i) => ({
              length: pageW,
              offset: pageW * i,
              index: i,
            })}
            onMomentumScrollEnd={(e) =>
              setIndex(
                Math.min(
                  n - 1,
                  Math.max(
                    0,
                    Math.round(e.nativeEvent.contentOffset.x / pageW),
                  ),
                ),
              )
            }
            renderItem={({ item }) => (
              <View style={{ width: pageW, paddingHorizontal: GUTTER }}>
                <SeasonItem
                  season={item}
                  details={details}
                  navigation={navigation}
                  watchedCount={getWatchedCount(item.season_number)}
                  watchEvents={getWatchEvents?.(item.season_number)}
                />
              </View>
            )}
          />
        )}
      </View>

      <View style={styles.footer}>
        <Ionicons
          name="swap-horizontal"
          size={13}
          color={theme.text?.muted ?? "#888"}
        />
        <Text
          allowFontScaling={false}
          style={[styles.hint, { color: theme.text?.muted ?? "#888" }]}
        >
          {i18nText(
            "autoI18n.kaydirarak_sezon_degistir",
            "Kaydırarak sezon değiştir",
          )}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.counter, { color: theme.accent }]}
        >
          {index + 1} / {n}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  hint: { fontSize: 11, flex: 1 },
  counter: { fontSize: 12, fontWeight: "800" },
});
