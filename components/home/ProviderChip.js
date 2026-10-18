// components/home/ProviderChip.js
//
// "Platformlar" rafının çipi (Film ve Dizi ana ekranlarında aynı): platform logosu + adı.
//   selected   : şu an rafta gösterilen platform (vurgu çerçevesi + vurgu zemini)
//   subscribed : kullanıcının üyeliği olan platform — seçili OLMASA da vurgu çerçevesi + onay simgesi
//                (liste zaten üyelikleri başa alır; işaret "bunlar senin" der)
// Çip DiscoverFilterChip'tir (uygulamadaki tek çip dili); logo `leading` düğümüyle girer.
import React, { memo } from "react";
import { StyleSheet } from "react-native";
import { Image } from "expo-image";
import DiscoverFilterChip from "./DiscoverFilterChip";
import { SECTION_CHIP_HEIGHT_LOGO } from "./SectionChips";
import { useImageQualitySettings } from "../../context/AppSettingsContext";

const LOGO = 26;

function ProviderChip({ provider, selected, subscribed, onPress }) {
  const { getTmdbUrl } = useImageQualitySettings();
  return (
    <DiscoverFilterChip
      label={provider.provider_name}
      selected={selected}
      marked={subscribed}
      onPress={onPress}
      style={styles.chip}
      leading={
        <Image
          source={{ uri: getTmdbUrl(provider.logo_path, "logo", 150) }}
          style={styles.logo}
          cachePolicy="memory-disk"
          transition={120}
        />
      }
    />
  );
}

export default memo(ProviderChip);

const styles = StyleSheet.create({
  // Logo çipi 42 yüksek; DiscoverFilterChip'in 18'lik köşesi bu yükseklikte kapsül olmaz.
  chip: {
    minHeight: SECTION_CHIP_HEIGHT_LOGO,
    borderRadius: SECTION_CHIP_HEIGHT_LOGO / 2,
    paddingLeft: 8,
  },
  logo: { width: LOGO, height: LOGO, borderRadius: 8 },
});
