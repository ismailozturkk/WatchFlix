// components/detail/ExternalRatingsRow.js
//
// Film / dizi detayında tanıdık harici puanlar: IMDb, Rotten Tomatoes, Metascore (OMDb, Cloud Function
// proxy'si üzerinden — services/externalRatings.js). Karar vermeyi hızlandıran TEK satır ve TEK dokunma hedefi:
// üç çip yan yana, yazı yerine simgeyle (components/detail/RatingLogos.js):
//
//   [IMDb] 8.1      [🍅] 93%      [80]
//
// Satıra basınca ayrıntı sayfası açılır (components/detail/ExternalRatingsSheet.js): adlar, açıklamalar, IMDb oy
// sayısı TAM, Taze/Çürük, Metascore'un sözel değerlendirmesi, ölçek çubukları. Oy sayısı bu yüzden çipte YOK
// (sığmıyordu); satır kısa kalır.
//
// SESSİZ OLMA KURALI: IMDb kimliği yoksa, sunucu cevap vermezse (ağ / kota / kimlik doğrulama) ya da hiçbir
// puan yoksa HİÇBİR ŞEY çizilmez — yükleme iskeleti de yok (detay sayfası zaten dolu; satır geç gelip yerleşimi
// zıplatmasın diye yalnız veri GELİNCE görünür). OMDb her başlık için Rotten Tomatoes / Metascore vermez
// (özellikle dizilerde yoktur): olmayan çip hiç çizilmez, "N/A" yazılmaz.
import React, { memo, useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { fetchTitleRatings } from "../../services/externalRatings";
import { getExternalRatingsCopy } from "../../utils/externalRatingsCopy";
import ExternalRatingsSheet from "./ExternalRatingsSheet";
import { ImdbLogo, MetascoreLogo, TomatoLogo } from "./RatingLogos";

function Chip({ logo, value, theme }) {
  return (
    <View style={[styles.chip, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {logo}
      {value ? (
        <Text allowFontScaling={false} style={[styles.value, { color: theme.text.primary }]}>
          {value}
        </Text>
      ) : null}
    </View>
  );
}

function ExternalRatingsRow({ imdbId }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getExternalRatingsCopy(language);
  const [ratings, setRatings] = useState(null);
  const [open, setOpen] = useState(false);
  const openSheet = useCallback(() => setOpen(true), []);
  const closeSheet = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setRatings(null);
    setOpen(false);
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
  const spoken = [];
  if (Number.isFinite(ratings.imdbRating)) {
    chips.push({ key: "imdb", logo: <ImdbLogo />, value: ratings.imdbRating.toFixed(1) });
    spoken.push(`IMDb ${ratings.imdbRating.toFixed(1)}/10`);
  }
  if (Number.isFinite(ratings.rottenTomatoes)) {
    chips.push({ key: "rt", logo: <TomatoLogo percent={ratings.rottenTomatoes} />, value: `${ratings.rottenTomatoes}%` });
    spoken.push(`Rotten Tomatoes ${ratings.rottenTomatoes}%`);
  }
  if (Number.isFinite(ratings.metascore)) {
    chips.push({ key: "meta", logo: <MetascoreLogo score={ratings.metascore} /> });
    spoken.push(`Metascore ${ratings.metascore}/100`);
  }
  if (chips.length === 0) return null;

  return (
    <>
      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={copy.open(spoken.join(", "))}
        hitSlop={6}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {chips.map(({ key, ...chip }) => (
          <Chip key={key} theme={theme} {...chip} />
        ))}
      </Pressable>
      <ExternalRatingsSheet visible={open} onClose={closeSheet} ratings={ratings} />
    </>
  );
}

export default memo(ExternalRatingsRow);

const styles = StyleSheet.create({
  // Satır içeriği kadar geniş: boş yere dokunma alanı açmaz (alignSelf).
  row: { alignSelf: "flex-start", flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 },
  pressed: { opacity: 0.75 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 30,
    paddingHorizontal: 7,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  value: { fontSize: 13, fontWeight: "800" },
});
