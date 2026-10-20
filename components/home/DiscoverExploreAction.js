// components/home/DiscoverExploreAction.js
//
// Film / Dizi ana ekranının KEŞFET düğmesi: üst satırda Film/Dizi anahtarının SOLUNDA duran tek simgeli
// yuvarlak cam düğme (sağında arama düğmesi var — ikisi anahtarın iki yanında simetrik). Dokununca "Ne izlesem?"
// ekranını (screens/shared/DiscoverFiltersScreen.js) seçili bölümün türüyle ve son kullanılan süzgeçle açar;
// hazır süzgeçler, kayıtlı süzgeçler ve "Şaşırt beni" orada.
//
// Eskiden listenin başında "Ne izlesem?" kartı vardı; çok yer kapladığı için kaldırıldı ve bu düğmeye
// çevrildi. Görünüm arama düğmesiyle AYNI kabuk (components/home/DiscoverSearchAction.js `discoverActionStyle`):
// iOS 26+'da Liquid Glass, cam çizilemeyen yerde tema yüzeyli çerçeveli daire.
//
// Bu düğmede opaklık / giriş animasyonu YOK (cam kuralı: GlassSurface, kural 1; ve Reanimated ilk-değer
// kaybolması — bkz. memory/reanimated-initial-value-vanish). Basma geri bildirimini GlassIconButton verir.
import React, { memo, useCallback } from "react";
import GlassIconButton from "../common/GlassIconButton";
import { useTheme } from "../../context/ThemeContext";
import { useLiquidGlass } from "../../services/liquidGlass";
import { DISCOVER_FILTERS_ROUTE } from "../../utils/discoverFilters";
import { discoverActionStyle, discoverSearchActionSize } from "./DiscoverSearchAction";

/**
 * @param {object} props.navigation
 * @param {"tv"|"movie"} props.mediaType  Açılacak ekranın başlangıç türü (anahtarın seçili bölümü)
 * @param {string} props.label            Erişilebilirlik etiketi ("Ne izlesem?")
 */
function DiscoverExploreAction({ navigation, mediaType, label }) {
  const { theme } = useTheme();
  const glass = useLiquidGlass();
  const size = discoverSearchActionSize(glass);

  const open = useCallback(
    () => navigation?.navigate?.(DISCOVER_FILTERS_ROUTE, { mediaType }),
    [mediaType, navigation],
  );

  return (
    <GlassIconButton
      testID="discover-explore-button"
      icon="compass-outline"
      iconSize={22}
      size={size}
      fallbackRadius={size / 2}
      {...discoverActionStyle(theme)}
      onPress={open}
      accessibilityLabel={label}
    />
  );
}

export default memo(DiscoverExploreAction);
