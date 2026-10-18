// components/detail/ExternalRatingsRow.js
//
// Film / dizi detayında tanıdık harici puanlar: IMDb, Rotten Tomatoes, Metascore (OMDb, Cloud Function
// proxy'si üzerinden — services/externalRatings.js). Karar vermeyi hızlandıran küçük bir satır.
//
// SESSİZ OLMA KURALI: IMDb kimliği yoksa, sunucu cevap vermezse (ağ / kota / kimlik doğrulama) ya da hiçbir
// puan yoksa HİÇBİR ŞEY çizilmez — yükleme iskeleti de yok (detay sayfası zaten dolu; satır geç gelip yerleşimi
// zıplatmasın diye yalnız veri GELİNCE görünür). Puan yoksa "N/A" yazılmaz.
//
// ETİKETLER marka adıdır (IMDb / Rotten Tomatoes / Metascore) ve çevrilmez; değer metni tema rengindedir.
import React, { memo, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { fetchTitleRatings } from "../../services/externalRatings";
import { formatImdbVotes } from "../../utils/externalRatings";

function Chip({ label, value, theme, accessibility }) {
  return (
    <View
      accessible
      accessibilityLabel={accessibility}
      style={[styles.chip, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <Text allowFontScaling={false} style={[styles.label, { color: theme.text.muted }]}>
        {label}
      </Text>
      <Text allowFontScaling={false} style={[styles.value, { color: theme.text.primary }]}>
        {value}
      </Text>
    </View>
  );
}

function ExternalRatingsRow({ imdbId }) {
  const { theme } = useTheme();
  const [ratings, setRatings] = useState(null);

  useEffect(() => {
    setRatings(null);
    if (!imdbId) return undefined;
    let active = true;
    fetchTitleRatings(imdbId).then((data) => {
      if (active && data?.found) setRatings(data);
    });
    return () => {
      active = false;
    };
  }, [imdbId]);

  if (!ratings) return null;
  const chips = [];
  if (Number.isFinite(ratings.imdbRating)) {
    const votes = formatImdbVotes(ratings.imdbVotes);
    chips.push({
      key: "imdb",
      label: "IMDb",
      value: ratings.imdbRating.toFixed(1),
      accessibility: `IMDb ${ratings.imdbRating.toFixed(1)}/10${votes ? `, ${votes}` : ""}`,
    });
  }
  if (Number.isFinite(ratings.rottenTomatoes)) {
    chips.push({
      key: "rt",
      label: "Rotten Tomatoes",
      value: `${ratings.rottenTomatoes}%`,
      accessibility: `Rotten Tomatoes ${ratings.rottenTomatoes}%`,
    });
  }
  if (Number.isFinite(ratings.metascore)) {
    chips.push({
      key: "meta",
      label: "Metascore",
      value: String(ratings.metascore),
      accessibility: `Metascore ${ratings.metascore}/100`,
    });
  }
  if (chips.length === 0) return null;

  return (
    <View style={styles.row}>
      {chips.map(({ key, ...chip }) => (
        <Chip key={key} theme={theme} {...chip} />
      ))}
    </View>
  );
}

export default memo(ExternalRatingsRow);

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.3 },
  value: { fontSize: 13, fontWeight: "800" },
});
