// context/TypographyContext.js
//
// Yazı tipi DOSYALARINI yükleyen tek yer. Tercihin kendisi burada DEĞİL,
// services/typographySettings.js içinde bir abonelik store'unda durur —
// gerekçesi orada yazılı (tercihi ağacın tepesindeki provider'da tutmak, font
// değişiminde tüm uygulamayı yeniden çizdiriyordu).
//
// AÇILIŞ STRATEJİSİ: manifest ~100 dosya, ama seçili üç rol en fazla üç aile
// kullanır (varsayılan "system"da hiçbiri). Açılışta YALNIZ o dosyalar yüklenip
// setFontsLoaded(true) denir; katalogdaki geri kalan dosyalara tek ihtiyaç
// ayarlardaki font galerisi olduğundan onlar açılış penceresinin dışında, arka
// planda yüklenir ve setCatalogFontsLoaded(true) ile duyurulur. Ayar ekranı
// arka plan yüklemesinden önce açılırsa ensureCatalogFontsLoaded() ile kalanı
// kendisi tetikler. Eskiden 105 dosyanın tamamı splash sırasında okunuyordu.
//
// Buradaki manifest ile utils/typographyRoles.js'teki FONT_FAMILY_MAP birbirini
// tutmak ZORUNDA: haritada olup burada yüklenmeyen bir aile hata vermez,
// sessizce sistem fontuna düşer. __tests__/typographyRoles.test.js bu dosyayı
// okuyup eşitliği doğrular — yeni bir aile eklerken iki tarafı da güncelle.
import * as Font from "expo-font";
import { useEffect } from "react";
import { InteractionManager } from "react-native";
import {
  getTypographyState,
  setCatalogFontsLoaded,
  setFontsLoaded,
  subscribeTypography,
} from "../services/typographySettings";
import { FONT_FAMILY_MAP, TEXT_ROLES } from "../utils/typographyRoles";

export const APP_FONT_MANIFEST = {
  Inter_400Regular: require("@expo-google-fonts/inter/400Regular").Inter_400Regular,
  Inter_400Regular_Italic: require("@expo-google-fonts/inter/400Regular_Italic").Inter_400Regular_Italic,
  Inter_500Medium: require("@expo-google-fonts/inter/500Medium").Inter_500Medium,
  Inter_500Medium_Italic: require("@expo-google-fonts/inter/500Medium_Italic").Inter_500Medium_Italic,
  Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold").Inter_600SemiBold,
  Inter_600SemiBold_Italic: require("@expo-google-fonts/inter/600SemiBold_Italic").Inter_600SemiBold_Italic,
  Inter_700Bold: require("@expo-google-fonts/inter/700Bold").Inter_700Bold,
  Inter_700Bold_Italic: require("@expo-google-fonts/inter/700Bold_Italic").Inter_700Bold_Italic,
  Inter_800ExtraBold: require("@expo-google-fonts/inter/800ExtraBold").Inter_800ExtraBold,
  Inter_800ExtraBold_Italic: require("@expo-google-fonts/inter/800ExtraBold_Italic").Inter_800ExtraBold_Italic,
  BebasNeue_400Regular: require("@expo-google-fonts/bebas-neue/400Regular").BebasNeue_400Regular,
  PlayfairDisplay_400Regular: require("@expo-google-fonts/playfair-display/400Regular").PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic: require("@expo-google-fonts/playfair-display/400Regular_Italic").PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium: require("@expo-google-fonts/playfair-display/500Medium").PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold: require("@expo-google-fonts/playfair-display/600SemiBold").PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold: require("@expo-google-fonts/playfair-display/700Bold").PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic: require("@expo-google-fonts/playfair-display/700Bold_Italic").PlayfairDisplay_700Bold_Italic,
  PlayfairDisplay_800ExtraBold: require("@expo-google-fonts/playfair-display/800ExtraBold").PlayfairDisplay_800ExtraBold,
  Unbounded_400Regular: require("@expo-google-fonts/unbounded/400Regular").Unbounded_400Regular,
  Unbounded_500Medium: require("@expo-google-fonts/unbounded/500Medium").Unbounded_500Medium,
  Unbounded_600SemiBold: require("@expo-google-fonts/unbounded/600SemiBold").Unbounded_600SemiBold,
  Unbounded_700Bold: require("@expo-google-fonts/unbounded/700Bold").Unbounded_700Bold,
  Unbounded_800ExtraBold: require("@expo-google-fonts/unbounded/800ExtraBold").Unbounded_800ExtraBold,
  SpaceMono_400Regular: require("@expo-google-fonts/space-mono/400Regular").SpaceMono_400Regular,
  SpaceMono_400Regular_Italic: require("@expo-google-fonts/space-mono/400Regular_Italic").SpaceMono_400Regular_Italic,
  SpaceMono_700Bold: require("@expo-google-fonts/space-mono/700Bold").SpaceMono_700Bold,
  SpaceMono_700Bold_Italic: require("@expo-google-fonts/space-mono/700Bold_Italic").SpaceMono_700Bold_Italic,
  Oswald_400Regular: require("@expo-google-fonts/oswald/400Regular").Oswald_400Regular,
  Oswald_500Medium: require("@expo-google-fonts/oswald/500Medium").Oswald_500Medium,
  Oswald_600SemiBold: require("@expo-google-fonts/oswald/600SemiBold").Oswald_600SemiBold,
  Oswald_700Bold: require("@expo-google-fonts/oswald/700Bold").Oswald_700Bold,
  Michroma_400Regular: require("@expo-google-fonts/michroma/400Regular").Michroma_400Regular,
  Limelight_400Regular: require("@expo-google-fonts/limelight/400Regular").Limelight_400Regular,
  Monoton_400Regular: require("@expo-google-fonts/monoton/400Regular").Monoton_400Regular,
  TiltWarp_400Regular: require("@expo-google-fonts/tilt-warp/400Regular").TiltWarp_400Regular,
  Righteous_400Regular: require("@expo-google-fonts/righteous/400Regular").Righteous_400Regular,
  Bungee_400Regular: require("@expo-google-fonts/bungee/400Regular").Bungee_400Regular,
  Syncopate_400Regular: require("@expo-google-fonts/syncopate/400Regular").Syncopate_400Regular,
  Syncopate_700Bold: require("@expo-google-fonts/syncopate/700Bold").Syncopate_700Bold,
  Audiowide_400Regular: require("@expo-google-fonts/audiowide/400Regular").Audiowide_400Regular,
  Barlow_400Regular: require("@expo-google-fonts/barlow/400Regular").Barlow_400Regular,
  Barlow_700Bold: require("@expo-google-fonts/barlow/700Bold").Barlow_700Bold,
  Alegreya_400Regular: require("@expo-google-fonts/alegreya/400Regular").Alegreya_400Regular,
  Alegreya_700Bold: require("@expo-google-fonts/alegreya/700Bold").Alegreya_700Bold,
  Bitter_400Regular: require("@expo-google-fonts/bitter/400Regular").Bitter_400Regular,
  Bitter_700Bold: require("@expo-google-fonts/bitter/700Bold").Bitter_700Bold,
  BreeSerif_400Regular: require("@expo-google-fonts/bree-serif/400Regular").BreeSerif_400Regular,
  Comfortaa_400Regular: require("@expo-google-fonts/comfortaa/400Regular").Comfortaa_400Regular,
  Comfortaa_700Bold: require("@expo-google-fonts/comfortaa/700Bold").Comfortaa_700Bold,
  JosefinSans_400Regular: require("@expo-google-fonts/josefin-sans/400Regular").JosefinSans_400Regular,
  JosefinSans_700Bold: require("@expo-google-fonts/josefin-sans/700Bold").JosefinSans_700Bold,
  Lexend_400Regular: require("@expo-google-fonts/lexend/400Regular").Lexend_400Regular,
  Lexend_700Bold: require("@expo-google-fonts/lexend/700Bold").Lexend_700Bold,
  Quicksand_400Regular: require("@expo-google-fonts/quicksand/400Regular").Quicksand_400Regular,
  Quicksand_700Bold: require("@expo-google-fonts/quicksand/700Bold").Quicksand_700Bold,
  Spectral_400Regular: require("@expo-google-fonts/spectral/400Regular").Spectral_400Regular,
  Spectral_700Bold: require("@expo-google-fonts/spectral/700Bold").Spectral_700Bold,
  Vollkorn_400Regular: require("@expo-google-fonts/vollkorn/400Regular").Vollkorn_400Regular,
  Vollkorn_700Bold: require("@expo-google-fonts/vollkorn/700Bold").Vollkorn_700Bold,
  ZillaSlab_400Regular: require("@expo-google-fonts/zilla-slab/400Regular").ZillaSlab_400Regular,
  ZillaSlab_700Bold: require("@expo-google-fonts/zilla-slab/700Bold").ZillaSlab_700Bold,
  RobotoMono_400Regular: require("@expo-google-fonts/roboto-mono/400Regular").RobotoMono_400Regular,
  RobotoMono_700Bold: require("@expo-google-fonts/roboto-mono/700Bold").RobotoMono_700Bold,
  IBMPlexMono_400Regular: require("@expo-google-fonts/ibm-plex-mono/400Regular").IBMPlexMono_400Regular,
  IBMPlexMono_700Bold: require("@expo-google-fonts/ibm-plex-mono/700Bold").IBMPlexMono_700Bold,
  JetBrainsMono_400Regular: require("@expo-google-fonts/jetbrains-mono/400Regular").JetBrainsMono_400Regular,
  JetBrainsMono_700Bold: require("@expo-google-fonts/jetbrains-mono/700Bold").JetBrainsMono_700Bold,
  Exo2_400Regular: require("@expo-google-fonts/exo-2/400Regular").Exo2_400Regular,
  Exo2_700Bold: require("@expo-google-fonts/exo-2/700Bold").Exo2_700Bold,
  Oxanium_400Regular: require("@expo-google-fonts/oxanium/400Regular").Oxanium_400Regular,
  Oxanium_700Bold: require("@expo-google-fonts/oxanium/700Bold").Oxanium_700Bold,
  Matemasie_400Regular: require("@expo-google-fonts/matemasie/400Regular").Matemasie_400Regular,
  NovaFlat_400Regular: require("@expo-google-fonts/nova-flat/400Regular").NovaFlat_400Regular,
  NewRocker_400Regular: require("@expo-google-fonts/new-rocker/400Regular").NewRocker_400Regular,
  Blaka_400Regular: require("@expo-google-fonts/blaka/400Regular").Blaka_400Regular,
  NovaSquare_400Regular: require("@expo-google-fonts/nova-square/400Regular").NovaSquare_400Regular,
  BitcountSingle_400Regular: require("@expo-google-fonts/bitcount-single/400Regular").BitcountSingle_400Regular,
  BitcountSingle_700Bold: require("@expo-google-fonts/bitcount-single/700Bold").BitcountSingle_700Bold,
  Kablammo_400Regular: require("@expo-google-fonts/kablammo/400Regular").Kablammo_400Regular,
  DenkOne_400Regular: require("@expo-google-fonts/denk-one/400Regular").DenkOne_400Regular,
  RubikGemstones_400Regular: require("@expo-google-fonts/rubik-gemstones/400Regular").RubikGemstones_400Regular,
  Smokum_400Regular: require("@expo-google-fonts/smokum/400Regular").Smokum_400Regular,
  Tourney_400Regular: require("@expo-google-fonts/tourney/400Regular").Tourney_400Regular,
  Tourney_700Bold: require("@expo-google-fonts/tourney/700Bold").Tourney_700Bold,
  Butcherman_400Regular: require("@expo-google-fonts/butcherman/400Regular").Butcherman_400Regular,
  ChakraPetch_400Regular: require("@expo-google-fonts/chakra-petch/400Regular").ChakraPetch_400Regular,
  ChakraPetch_700Bold: require("@expo-google-fonts/chakra-petch/700Bold").ChakraPetch_700Bold,
  PressStart2P_400Regular: require("@expo-google-fonts/press-start-2p/400Regular").PressStart2P_400Regular,
  FascinateInline_400Regular: require("@expo-google-fonts/fascinate-inline/400Regular").FascinateInline_400Regular,
  RubikDoodleShadow_400Regular: require("@expo-google-fonts/rubik-doodle-shadow/400Regular").RubikDoodleShadow_400Regular,
  BrunoAceSC_400Regular: require("@expo-google-fonts/bruno-ace-sc/400Regular").BrunoAceSC_400Regular,
  ClimateCrisis_400Regular: require("@expo-google-fonts/climate-crisis/400Regular").ClimateCrisis_400Regular,
  RibeyeMarrow_400Regular: require("@expo-google-fonts/ribeye-marrow/400Regular").RibeyeMarrow_400Regular,
  RubikWetPaint_400Regular: require("@expo-google-fonts/rubik-wet-paint/400Regular").RubikWetPaint_400Regular,
  Sancreek_400Regular: require("@expo-google-fonts/sancreek/400Regular").Sancreek_400Regular,
  BungeeShade_400Regular: require("@expo-google-fonts/bungee-shade/400Regular").BungeeShade_400Regular,
  Gluten_400Regular: require("@expo-google-fonts/gluten/400Regular").Gluten_400Regular,
  Gluten_700Bold: require("@expo-google-fonts/gluten/700Bold").Gluten_700Bold,
  GloriaHallelujah_400Regular: require("@expo-google-fonts/gloria-hallelujah/400Regular").GloriaHallelujah_400Regular,
  Carattere_400Regular: require("@expo-google-fonts/carattere/400Regular").Carattere_400Regular,
  Offside_400Regular: require("@expo-google-fonts/offside/400Regular").Offside_400Regular,
  IndieFlower_400Regular: require("@expo-google-fonts/indie-flower/400Regular").IndieFlower_400Regular,
  SairaStencilOne_400Regular: require("@expo-google-fonts/saira-stencil-one/400Regular").SairaStencilOne_400Regular,
  Courgette_400Regular: require("@expo-google-fonts/courgette/400Regular").Courgette_400Regular,
  Julee_400Regular: require("@expo-google-fonts/julee/400Regular").Julee_400Regular,
};

// Katalog yüklemesini açılış penceresinin dışına atan gecikme. ChatModal
// 3,8 sn'de mount oluyor (App.js); katalog G/Ç'si onunla da yarışmasın.
const KATALOG_ERTELEME_MS = 5000;

/** Seçili rollerin (heading/body/numeric) kullandığı tüm aile adları. */
const rolAileAdlari = (roller) => {
  const adlar = new Set();
  for (const rol of TEXT_ROLES) {
    const aile = FONT_FAMILY_MAP[roller[rol]];
    if (!aile) continue; // "system": dosya gerekmez
    for (const varyant of Object.values(aile)) {
      for (const ad of Object.values(varyant)) adlar.add(ad);
    }
  }
  return adlar;
};

const manifestParcasi = (adlar) => {
  const parca = {};
  for (const ad of adlar) {
    if (APP_FONT_MANIFEST[ad]) parca[ad] = APP_FONT_MANIFEST[ad];
  }
  return parca;
};

// Söz modül seviyesinde: Fast Refresh'te provider yeniden mount olsa da katalog
// bir kez yüklenir. Hata olursa sıfırlanır ki sonraki çağrı yeniden denesin.
let katalogSozu = null;

/** Katalogdaki TÜM fontları yükler (idempotent; yüklüler atlanır). */
export function ensureCatalogFontsLoaded() {
  if (!katalogSozu) {
    katalogSozu = Font.loadAsync(APP_FONT_MANIFEST).then(
      () => setCatalogFontsLoaded(true),
      (hata) => {
        katalogSozu = null;
        console.warn("Font kataloğu yüklenemedi:", hata?.message);
      },
    );
  }
  return katalogSozu;
}

// Rol değişimleri yarışabilir: yalnız SON isteğin sonucu bayrağı açar (eski
// istek geç bitince yeni rolün eksik dosyalarıyla "hazır" demesin).
let rolYuklemeKimligi = 0;

/** Seçili rollerin dosyalarını tamamlar; hepsi hazır olunca fontsLoaded=true. */
const rolFontlariniYukle = () => {
  const eksikler = [...rolAileAdlari(getTypographyState())].filter(
    (ad) => !Font.isLoaded(ad),
  );
  if (eksikler.length === 0) {
    setFontsLoaded(true);
    return;
  }
  // Dosyası inmemiş aile adı vermek metni görünmez kılabilir; inene kadar
  // sistem fontu çizilir (eski useFonts akışıyla aynı sözleşme).
  setFontsLoaded(false);
  const kimlik = ++rolYuklemeKimligi;
  Font.loadAsync(manifestParcasi(eksikler)).then(
    () => {
      if (kimlik === rolYuklemeKimligi) setFontsLoaded(true);
    },
    (hata) => {
      // Eski davranışla aynı: yükleme başarısızsa bayrak kapalı kalır,
      // uygulama sistem fontuyla devam eder.
      console.warn("Rol fontları yüklenemedi:", hata?.message);
    },
  );
};

export function TypographyProvider({ children }) {
  useEffect(() => {
    let onceki = getTypographyState();
    rolFontlariniYukle();
    // Rol değişince (ayar ekranındaki seçim, MMKV göçünün geç yazması) yeni
    // ailenin dosyalarını tamamla. Bayrak değişimlerinde roller aynı kaldığı
    // için yeniden yükleme tetiklenmez.
    const birak = subscribeTypography(() => {
      const simdiki = getTypographyState();
      let rolDegisti = false;
      for (const rol of TEXT_ROLES) {
        if (simdiki[rol] !== onceki[rol]) {
          rolDegisti = true;
          break;
        }
      }
      onceki = simdiki;
      if (rolDegisti) rolFontlariniYukle();
    });

    // Katalog: açılış animasyonları bitip uygulama oturduktan sonra.
    let zamanlayici = null;
    const gorev = InteractionManager.runAfterInteractions(() => {
      zamanlayici = setTimeout(ensureCatalogFontsLoaded, KATALOG_ERTELEME_MS);
    });

    return () => {
      birak();
      gorev.cancel?.();
      if (zamanlayici) clearTimeout(zamanlayici);
    };
  }, []);

  return children;
}
