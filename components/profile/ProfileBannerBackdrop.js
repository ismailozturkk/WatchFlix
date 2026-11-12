// components/profile/ProfileBannerBackdrop.js
//
// Profil kapağının (banner) ekranın en üstüne sabitlenmiş, kaydırmaya bağlı hâli.
// Görünen profil ekranı (FriendProfileScreen: arkadaş profili ve kendi profilinin
// önizleme/düzenleme modu) kullanır.
//
// GÖRÜNÜM film/dizi detayındaki arka plan posteriyle AYNI (DetailHeroStage):
// üstte durum çubuğu altında görselin yansıyan bulanık devamı, ortada 16:9 sahnenin
// TAMAMI (en-boy oranı korunur, kırpılmaz), altta bulanık devam + tema zeminine
// yumuşak geçiş; sınırlarda kademeli bulanıklık.
//
// HAREKET de ortak (components/common/heroScrollMotion.js): aşağı kaydırınca yavaş
// yükselip kararır ve söner, üstten çekince esner. Yuva ekrana sabit olduğu için
// fixedHeroMotion; boyuna orantılı ayar detay sayfalarıyla aynı.

import React from "react";
import { Animated, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DetailHeroStage, { computeDetailHeroMetrics } from "../detail/DetailHeroStage";
import { HeroDarkenOverlay, fixedHeroMotion, heroMotionTuning } from "../common/heroScrollMotion";
import { useTheme } from "../../context/ThemeContext";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
import { normalizeProfileBanner } from "../../utils/profileBanner";

/** Kapak yuvasının toplam boyu (çağıran boşlukları buna göre ayarlayabilsin). */
export function profileBannerHeight({ width, topInset }) {
  return computeDetailHeroMetrics({ width, topInset }).stageHeight;
}

// Avatarın kapağa binme payı: yalnız alt bulanık şerit + sahnenin alt kenarı.
const AVATAR_OVERLAP = 44;

/**
 * Kapak varken içeriğin (avatar) üstünde bırakılacak boşluk: sahnenin 16:9 gövdesi
 * avatarın altında kaybolmasın diye kapak boyundan, içeriğin zaten başladığı
 * yer (`contentTop`, ekran üstünden) ve binme payı düşülür. En az `min`.
 */
export function profileBannerSpacer({ width, topInset, contentTop, min = 0 }) {
  const h = profileBannerHeight({ width, topInset });
  return Math.max(min, Math.round(h - contentTop - AVATAR_OVERLAP));
}

export default function ProfileBannerBackdrop({ banner, scrollY, width, style }) {
  const { theme } = useTheme();
  const { getTmdbUrl } = useImageQualitySettings();
  const insets = useSafeAreaInsets();
  const safe = normalizeProfileBanner(banner);
  if (!safe) return null;

  const height = profileBannerHeight({ width, topInset: insets.top });
  const tuning = heroMotionTuning(height);
  // Kullanıcının SEÇTİĞİ sahne: izleyenin özel arka plan seçimi bunu ezmez
  // (posterChoicesCoverage → EXCLUDED_BACKDROP).
  // Genişlik dp olarak verilir; getTmdbUrl piksel oranını kendisi uygular. Eskiden
  // `width * 2` veriliyordu → ×3 ile ~2400 px → TMDB "original" (4K'ya kadar)
  // iniyordu (ısınma denetimi, 11 Kas). Ambiyans katmanları küçük görselle (~w300).
  const uri = getTmdbUrl(safe.path, "backdrop", Math.round(width));
  const ambientUri = getTmdbUrl(safe.path, "backdrop", 100);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { height }, fixedHeroMotion(scrollY, height, tuning), style]}
    >
      <DetailHeroStage uri={uri} ambientUri={ambientUri} theme={theme} topInset={insets.top} width={width} />
      <HeroDarkenOverlay scrollY={scrollY} fadeAt={tuning.fadeAt} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0 },
});
