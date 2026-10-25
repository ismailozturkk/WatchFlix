// components/home/DiscoverSearchAction.js
//
// Film / Dizi ana ekranının (screens/tabs/DiscoverScreen.js) arama düğmesi: ekranın tepesindeki
// Film/Dizi anahtarının (MediaTypeSwitch) hemen YANINDA duran yuvarlak cam düğme. Eskiden
// listelerin başında tam genişlikte bir "Film Ara / Dizi Ara" hapı vardı ve iki sayfada ayrı ayrı
// duruyordu; ikisi aynı arama ekranını (UnifiedSearch) açtığı için tek düğme anahtarın yanına
// alındı. Hangi içeriğin aranacağı anahtarın seçili bölümünden gelir (`mediaType`).
//
// GÖRSEL DİL: anahtarla (MediaTypeSwitch) AYNI kabuk dili — iOS 26+'da Liquid Glass (aynı ton:
// GlassField ile aynı `tint`), cam çizilemeyen yerde (Android, iOS 18–25, Efektler: Kapalı)
// tema yüzeyli, çerçeveli, hafif gölgeli daire. Cam yolunda yükseklik anahtarla birebir; eski
// yolda anahtarın 1 px çerçevesi 2 px eklediği için daire de 2 px büyük (ikisi aynı hizada biter).
//
// AÇILIŞ GEÇİŞİ: dokununca arama ekranı düğmenin konumundan ve yuvarlak köşesinden genişleyerek
// açılır (`searchOrigin`, bkz. screens/tabs/SearchScreen.js). Ölçüm düğmenin kendisinden alınır.
//
// Bu düğmede opaklık / giriş animasyonu YOK (cam kuralı: GlassSurface, kural 1; ve Reanimated
// ilk-değer kaybolması — bkz. memory/reanimated-initial-value-vanish). Basma geri bildirimini
// GlassIconButton verir (cam yolunda sistem esnemesi, eski yolda hafif saydamlık).
import React, { memo, useCallback, useRef } from "react";
import { View } from "react-native";
import GlassIconButton from "../common/GlassIconButton";
import { GLASS_FIELD_TINT_ALPHA } from "../common/GlassField";
import { useTheme } from "../../context/ThemeContext";
import { useGlassShape } from "../../services/liquidGlass";
import { alpha } from "../../theme/colors";
import { MEDIA_SWITCH_HEIGHT } from "./MediaTypeSwitch";

/** Cam yolunda dairenin çapı: anahtarın yüksekliğiyle aynı. */
export const DISCOVER_SEARCH_ACTION_SIZE = MEDIA_SWITCH_HEIGHT;
/** Cam OLMAYAN yolda anahtarın çerçevesi 2 px ekler; daire de aynı kadar büyür. */
const FALLBACK_BORDER_EXTRA = 2;

/**
 * Yuvarlak düğmenin cam tonu + cam OLMAYAN yoldaki kutusu. Arama ve keşfet düğmeleri (iki yanda simetrik)
 * AYNI görünür; ikisi bu tek yerden okur, biri değişirse öteki ayrışmaz.
 */
export const discoverActionStyle = (theme) => ({
  tint: alpha(theme.secondary, GLASS_FIELD_TINT_ALPHA),
  fallbackStyle: {
    backgroundColor: theme.secondary,
    borderColor: theme.border,
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});

/** Çizim yoluna göre dairenin çapı (`shaped`: gerçek cam ya da Android buzlu camı — çerçevesiz). */
export const discoverSearchActionSize = (shaped) =>
  shaped ? DISCOVER_SEARCH_ACTION_SIZE : DISCOVER_SEARCH_ACTION_SIZE + FALLBACK_BORDER_EXTRA;

/**
 * @param {object} props.navigation
 * @param {"tv"|"movie"} props.mediaType  Aranacak içerik türü (arama ekranı bu sekmeyle açılır)
 * @param {string} props.label            Erişilebilirlik etiketi ("Film Ara" / "Dizi Ara")
 */
function DiscoverSearchAction({ navigation, mediaType, label }) {
  const { theme } = useTheme();
  const size = discoverSearchActionSize(useGlassShape());
  const buttonRef = useRef(null);

  const openSearch = useCallback(() => {
    const navigateToSearch = (searchOrigin) => {
      navigation.navigate("UnifiedSearch", {
        initialType: mediaType,
        autoFocus: true,
        searchOrigin,
      });
    };

    if (buttonRef.current?.measureInWindow) {
      buttonRef.current.measureInWindow((x, y, width, height) => {
        navigateToSearch({ x, y, width, height, radius: size / 2 });
      });
      return;
    }

    // Ölçülemiyorsa (nadir) geçişsiz aç; arama yine de açılır.
    navigateToSearch(undefined);
  }, [mediaType, navigation, size]);

  return (
    // Ölçülebilir kabuk: `measureInWindow` düğmenin pencere içindeki konumunu verir.
    <View ref={buttonRef} collapsable={false}>
      <GlassIconButton
        testID="discover-search-button"
        icon="search"
        iconSize={20}
        size={size}
        fallbackRadius={size / 2}
        {...discoverActionStyle(theme)}
        onPress={openSearch}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default memo(DiscoverSearchAction);
