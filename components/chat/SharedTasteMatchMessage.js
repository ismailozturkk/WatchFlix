// components/chat/SharedTasteMatchMessage.js
//
// Sohbette paylaşılan ZEVK UYUMU balonunun gövdesi (mesaj kind: "tasteMatchShare", bkz. utils/chatShare.js).
//
// DÜZEN = arkadaş profilindeki zevk uyumu kartının TÜRLER DAHİL üst kısmı, aynı parçalarla (friends/TasteMatchParts):
// iki tarafın adı → halka + kademe (+ kapsam / yaklaşık notu) → ısı çubuğu → az veri uyarısı → Film / Dizi kutuları →
// sayı şeridi (ortak izlenen · ortak favori · puan uyumu) → ortak tür çipleri. Derin analiz, içgörüler ve afişler
// sohbete GİTMEZ (kart türlerde biter).
//
// Metinler profil kartıyla AYNI tablodan (utils/tasteMatchCopy) ve ALICININ diliyle çizilir; gönderenin dili yalnız
// gelen kutusu önizlemesinde (`text`) kalır. Dokunulabilir bir eylem yok: bu bir sonuç kartı.
//
// ESKİ MESAJLAR: `types` alanı olmayan eski gövdelerde Film / Dizi kutusu düz `movie` / `tv` puanından çizilir
// (ortak sayısı yazılmaz); hiç yoksa kutular çizilmez.

import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { alpha } from "../../theme/colors";
import { getTasteMatchCopy } from "../../utils/tasteMatchCopy";
import { localizeGenreList } from "../../utils/genreDisplay";
import { tasteMatchHeat } from "../../utils/tasteMatchVisuals";
import { sharePalette } from "./shareKit";
import { GenreChips, HeatBar, StatsStrip, TasteHead, TypeTiles } from "../friends/TasteMatchParts";

const LOW_DATA_COLOR = "#F5A524";
const ROSE = "#E11D48";

/** Paylaşım gövdesinden Film / Dizi kutu bilgisi; eski gövdede düz puandan. Gösterilecek bir şey yoksa null. */
function typeInfoOf(share, key) {
  const entry = share.types?.[key];
  if (entry) return entry.shared === false ? { shared: false } : { shared: true, score: entry.score ?? null, overlap: entry.overlap };
  if (typeof share[key] === "number") return { shared: true, score: share[key] };
  return null;
}

function SharedTasteMatchMessage({ share, isOutgoing = false, neutralCard = false, cardWidth = 240 }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getTasteMatchCopy(language);
  const accent = theme.accent;
  const heat = tasteMatchHeat(share.score, accent);
  const visualOutgoing = isOutgoing && !neutralCard;
  const palette = useMemo(() => sharePalette({ theme, isOutgoing: visualOutgoing, accent }), [theme, visualOutgoing, accent]);
  const pct = (n) => copy.percent(n);

  const muted = palette.secondary;
  const tone = {
    primary: palette.primary,
    muted,
    track: alpha(visualOutgoing ? "#FFFFFF" : muted, 0.22),
    border: visualOutgoing ? palette.surfaceBorder : theme.border,
    accent: visualOutgoing ? "#FFFFFF" : accent,
    strip: palette.surface,
  };
  const blue = theme.colors?.blue ?? "#64b4ff";
  const green = theme.colors?.green ?? "#29b864";
  const orange = theme.colors?.orange ?? "#ff9650";

  const names = share.host && share.friend ? `${share.host} & ${share.friend}` : share.host || share.friend || "";
  const partOf = (id) => share.parts?.find((part) => part.id === id)?.value;

  const movie = typeInfoOf(share, "movie");
  const tv = typeInfoOf(share, "tv");
  // Profildeki gibi iki kutu yan yana; biri yoksa (eski gövde) "yeterli veri yok" kutusu olarak durur.
  const showTypes = !!(movie || tv);
  const notEnough = { shared: true, score: null };

  const stats = [
    typeof share.overlap === "number"
      ? { key: "overlap", icon: "checkmark-done-outline", value: String(share.overlap), label: copy.parts.overlap, bar: partOf("overlap"), color: tone.accent }
      : null,
    share.favorites > 0 || partOf("favorites") !== undefined
      ? { key: "favorites", icon: "heart-outline", value: String(share.favorites ?? 0), label: copy.parts.favorites, bar: partOf("favorites"), color: ROSE }
      : null,
    typeof share.agreement === "number"
      ? { key: "ratings", icon: "star-half-outline", value: pct(share.agreement), label: copy.parts.ratings, bar: partOf("ratings"), color: orange }
      : null,
  ].filter(Boolean);
  const genres = localizeGenreList(share.genres || [], language);

  const subText = share.scope === "movies" || share.scope === "shows" ? copy.scopeOnly[share.scope] : share.limited ? copy.limited : null;

  return (
    <View style={[styles.wrap, { width: cardWidth }]}>
      <View style={styles.kickerRow}>
        <Ionicons name="heart" size={12} color={heat.level > 0 ? heat.accent : palette.tileInk} />
        <Text allowFontScaling={false} style={[styles.kicker, { color: palette.tileInk }]} numberOfLines={1}>
          {copy.title.toUpperCase()}
        </Text>
        {names ? (
          <Text style={[styles.names, { color: muted }]} numberOfLines={1}>
            {names}
          </Text>
        ) : null}
      </View>

      <TasteHead
        score={share.score}
        title={copy.tiers[share.tier] || copy.title}
        heat={heat}
        tone={tone}
        percentText={{ label: `${copy.title}: ${pct(share.score)}`, value: pct(share.score) }}
        sub={
          subText ? (
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.sub, { color: muted }]}>
              {subText}
            </Text>
          ) : null
        }
      />

      <HeatBar score={share.score} heat={heat} track={tone.track} />

      {share.lowData ? (
        <View style={[styles.lowData, { backgroundColor: alpha(LOW_DATA_COLOR, 0.12), borderColor: alpha(LOW_DATA_COLOR, 0.35) }]}>
          <Ionicons name="warning-outline" size={13} color={LOW_DATA_COLOR} />
          <Text allowFontScaling={false} numberOfLines={2} style={[styles.lowDataText, { color: palette.primary }]}>
            {copy.lowData}
          </Text>
        </View>
      ) : null}

      {showTypes ? (
        <TypeTiles movie={movie || notEnough} tv={tv || notEnough} colors={{ movie: blue, tv: green }} {...{ copy, tone, pct }} />
      ) : null}

      <StatsStrip stats={stats} tone={tone} />
      <GenreChips genres={genres} label={copy.parts.genres} tone={tone} />
    </View>
  );
}

export default memo(SharedTasteMatchMessage);

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", width: 240, marginBottom: 2, gap: 8 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  kicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8 },
  names: { flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: "700", textAlign: "right" },
  sub: { fontSize: 12, lineHeight: 16 },
  lowData: { flexDirection: "row", alignItems: "flex-start", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 },
  lowDataText: { flex: 1, fontSize: 11, fontWeight: "700", lineHeight: 15 },
});
