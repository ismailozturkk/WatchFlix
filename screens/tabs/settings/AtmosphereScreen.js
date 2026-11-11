// screens/tabs/settings/AtmosphereScreen.js
//
// Ayarlar > Atmosfer. Üstte telefon önizlemesi, altta ayarlar:
//   • aç/kapa = TELEFONA DOKUN (basma yayı + güç simgesi; Free'de yükseltme
//     sayfası, Premium: snow_effect). Durum yazısı telefonun içinde, adanın
//     altında (alan kazanmak için önizlemenin altında değil).
//   • efekt seçici (5 grup; çipler simge, seçilinin adı açılır)
//   • yoğunluk: telefonun SOLUNDA dikey seçici (kayan vurgu)
//   • "Detaylarda türe göre": telefonun SAĞINDA dikey anahtar; açıkken altta
//     önizlemede tür denemesi (en fazla 3 tür)
//   • arka plan katmanları (9 Kas, Kişiselleştirme'den taşındı): Ambiyans
//     arka planı + İkon arka planı kartları (components/settings/
//     BackgroundLayerCards.js). Önizlemede katman sırası gerçek ekranlardaki
//     gibi: ambiyans → ikon deseni → atmosfer → içerik; ayar değişince anında
//     güncellenir, açılıp kapanınca katman yumuşakça belirir/söner.
//
// ÖNİZLEME GERÇEK BOYUTTA çizilir ve küçültülür: telefonun içindeki ekran,
// cihaz ekranı boyutunda (dp) kurulur, sonra `scale` ile çerçeveye sığdırılır.
// Böylece parçacık boyu, sayısı, kıyının yüksekliği ve şimşeğin boyu tam
// ekrandakinin birebir küçüğü — "nasıl duracak" sorusunun dürüst cevabı.
// Atmosfer, gerçek ekranlardaki gibi içeriğin ARKASINDA; sahte kartlar yarı
// saydam (cam kart gibi) ki arkası görünsün.
//
// Efekt kapalıyken ve Free'de de önizleme oynar (ne alacağını görür). Bu
// ekranın kendi tam ekran dekoru çizilmez (decorEffects boş): önizleme üç
// katmanı da zaten gösteriyor, ikinci kopya boşuna maliyet ve göz yorardı.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import AppIcon from "@components/AppIcon";
import WeatherLayer from "@components/decor/WeatherLayer";
import { AmbientLayer } from "@components/AmbientBackground";
import { IconPattern } from "@components/IconBacground";
import {
  AmbientLayerCard,
  DecorScopesCard,
  IconLayerCard,
  RegenerateBackgroundCard,
} from "@components/settings/BackgroundLayerCards";
import {
  ChipRow,
  DENSITY_LABELS,
  SPECIAL_DAY_ICONS,
  SPECIAL_DAY_LABELS,
  WEATHER_ICONS,
  WeatherPicker,
  weatherChoiceLabel,
} from "@components/settings/AtmosphereControls";
import { usePremiumGate } from "@hooks/usePremiumGate";
import useWeatherSettings from "@hooks/useWeatherSettings";
import useAppActive from "@hooks/useAppActive";
import useReduceMotion from "@hooks/useReduceMotion";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import {
  useAmbientBackgroundSettings,
  useIconBackgroundSettings,
  useSnowSettings,
} from "@context/AppSettingsContext";
import { useEffectMode } from "@services/effectSettings";
import * as Haptics from "@services/hapticsService";
import { i18nText } from "@utils/i18nText";
import { copyLanguage } from "@utils/appLanguages";
import { GENRE_LABELS } from "@utils/genreDisplay";
import { GENRE_MIX_MAX, SPECIAL_DAYS, genreEffectsFor, resolvePlan } from "@utils/weatherParticles";
import SwitchToggle from "@components/SwitchToggle";
import { alpha } from "@theme/colors";
import GlassBox from "../../../components/common/GlassBox";
import GlassTouchable from "../../../components/common/GlassTouchable";
import GlassPressable from "../../../components/common/GlassPressable";
import AtmosphereGenreInfoSheet from "@components/settings/AtmosphereGenreInfoSheet";
import { GLASS_PRESS_ROOM } from "../../../utils/liquidGlass";
import { DECOR_DENSITIES } from "@utils/decorLayout";
import { SettingsSubScreen, buildUiColors } from "./settingsUi";

// Ekranın kendi tam ekran dekoru yok: önizleme hepsini gösteriyor.
const NO_SCREEN_DECOR = [];
// Önizlemedeki sahte ekran ana ekran (Film/Dizi): oradaki desen opaklığı.
const PREVIEW_ICON_OPACITY = 0.3;

// Önizlemede denenebilecek türler: kanonik tür → TMDB id (WeatherLayer id
// bekler). Her biri farklı bir efekte gider.
const SAMPLE_GENRES = [
  ["action", 28],
  ["romance", 10749],
  ["horror", 27],
  ["scifi", 878],
  ["comedy", 35],
  ["fantasy", 14],
  ["thriller", 53],
  ["drama", 18],
  ["animation", 16],
  ["adventure", 12],
  ["crime", 80],
  ["mystery", 9648],
  ["music", 10402],
  ["family", 10751],
  ["history", 36],
  ["war", 10752],
  ["western", 37],
  ["documentary", 99],
];

// Tür çiplerinin simgeleri (çip kapalıyken yalnız simge görünür).
const MCI = "MaterialCommunityIcons";
const GENRE_ICONS = {
  action: { family: MCI, name: "sword-cross" },
  romance: { name: "heart-outline" },
  horror: { family: MCI, name: "ghost-outline" },
  scifi: { name: "planet-outline" },
  comedy: { name: "happy-outline" },
  fantasy: { family: MCI, name: "wizard-hat" },
  thriller: { name: "thunderstorm-outline" },
  drama: { family: MCI, name: "drama-masks" },
  animation: { name: "color-palette-outline" },
  adventure: { name: "compass-outline" },
  crime: { family: MCI, name: "handcuffs" },
  mystery: { family: MCI, name: "incognito" },
  music: { name: "musical-notes-outline" },
  family: { name: "people-outline" },
  history: { name: "hourglass-outline" },
  war: { family: MCI, name: "tank" },
  western: { family: MCI, name: "cactus" },
  documentary: { name: "videocam-outline" },
};

const LANGS = ["tr", "en", "es", "pt", "de"];
const BEZEL = 7;
// Kapalıyken atmosferin önizlemedeki sönüklüğü.
const DIM_OPACITY = 0.28;

// ── Telefon önizlemesi ─────────────────────────────────────────────────────

// Katman aç/kapa: yumuşak belirme/sönme; sönme bitince çocuk sökülür (kapalı
// katmanın saati/abonelikleri boşuna çalışmasın).
function FadeLayer({ visible, children }) {
  const [mounted, setMounted] = useState(visible);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
      return undefined;
    }
    const anim = Animated.timing(opacity, {
      toValue: 0,
      duration: 260,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) setMounted(false);
    });
    return () => anim.stop();
  }, [visible, opacity]);
  if (!mounted) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      {children}
    </Animated.View>
  );
}

// Sahte ana ekran: gerçek ekran boyutunda (dp) kurulur. Kartlar yarı saydam.
function MockScreen({ theme, width, height, topInset }) {
  const card = alpha(theme.secondary, 0.62);
  const line = alpha(theme.text.muted, 0.28);
  const posterW = Math.round((width - 16 * 2 - 10 * 2) / 3);
  const posterH = Math.round(posterW * 1.5);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topInset }]} pointerEvents="none">
      <View style={ms.statusBar}>
        <Text allowFontScaling={false} style={[ms.clock, { color: theme.text.primary }]}>
          9:41
        </Text>
        <View style={ms.statusIcons}>
          <AppIcon name="cellular" size={15} color={theme.text.primary} />
          <AppIcon name="wifi" size={15} color={theme.text.primary} />
          <AppIcon name="battery-full" size={20} color={theme.text.primary} />
        </View>
      </View>
      <View style={ms.header}>
        <View style={[ms.titleBar, { backgroundColor: alpha(theme.text.primary, 0.85) }]} />
        <View style={[ms.avatar, { backgroundColor: alpha(theme.accent, 0.55) }]} />
      </View>
      <LinearGradient
        colors={[alpha(theme.accent, 0.5), alpha(theme.secondary, 0.55)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ms.hero}
      >
        <View style={[ms.heroLine, { backgroundColor: alpha("#ffffff", 0.75), width: "52%" }]} />
        <View style={[ms.heroLine, { backgroundColor: alpha("#ffffff", 0.45), width: "34%", height: 8 }]} />
      </LinearGradient>
      {[0, 1].map((rail) => (
        <View key={rail} style={ms.rail}>
          <View style={[ms.railTitle, { backgroundColor: line }]} />
          <View style={ms.posters}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  ms.poster,
                  {
                    width: posterW,
                    height: posterH,
                    backgroundColor: card,
                    borderColor: alpha(theme.border, 0.6),
                  },
                ]}
              />
            ))}
          </View>
        </View>
      ))}
      <View
        style={[
          ms.tabBar,
          { top: height - 92, backgroundColor: alpha(theme.secondary, 0.78), borderColor: alpha(theme.border, 0.7) },
        ]}
      >
        {["film-outline", "game-controller-outline", "library-outline", "person-outline"].map((icon, i) => (
          <AppIcon key={icon} name={icon} size={24} color={i === 0 ? theme.accent : theme.text.muted} />
        ))}
      </View>
    </View>
  );
}

// Dokunma geri bildirimi: telefon hafifçe çöker ve yaylanır; ortada güç
// simgesi parlar. Kapalıyken atmosfer sönük (yine de görünür: ne açılacağı
// belli), açınca tam parlaklığa çıkar. Hepsi RN Animated + yerel sürücü
// (opaklık/dönüşüm), React render'ı yok.
function PhonePreview({
  theme,
  frameHeight,
  playing,
  genres,
  effectOverride,
  on,
  dim,
  ambient,
  icon,
  status,
  statusOn,
  onPress,
  a11y,
  showContent = true,
  onToggleContent,
  expanded = false,
  onToggleExpand,
}) {
  // Cihaz ekranı (pencere değil: klavye/çoklu pencere boyutu oynatmasın).
  const [screen] = useState(() => Dimensions.get("screen"));
  const innerH = frameHeight - BEZEL * 2;
  const scale = innerH / screen.height;
  const innerW = Math.round(screen.width * scale);
  const frameW = innerW + BEZEL * 2;
  const radius = Math.round(frameW * 0.15);
  const islandH = Math.max(8, innerH * 0.034);

  const press = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(dim ? DIM_OPACITY : 1)).current;
  const first = useRef(true);

  useEffect(() => {
    Animated.timing(glow, {
      toValue: dim ? DIM_OPACITY : 1,
      duration: 380,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    if (first.current) {
      first.current = false;
      return;
    }
    // Durum değişti: güç simgesi parlayıp söner.
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 160, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 420, delay: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [on, dim, flash, glow]);

  const pressIn = () =>
    Animated.spring(press, { toValue: 0.94, speed: 40, bounciness: 0, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(press, { toValue: 1, speed: 14, bounciness: 12, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={a11y.label}
      accessibilityHint={a11y.hint}
    >
      <Animated.View
        style={[pp.frame, { width: frameW, height: frameHeight, borderRadius: radius, transform: [{ scale: press }] }]}
      >
        <View
          style={[
            pp.screen,
            { width: innerW, height: innerH, borderRadius: radius - BEZEL, backgroundColor: theme.primary },
          ]}
        >
          {/* Gerçek boyutta kur, ortadan küçült: sol/üst kayma, ölçeğin merkezden
              uygulanmasını telafi eder. */}
          <View
            style={{
              position: "absolute",
              width: screen.width,
              height: screen.height,
              left: (innerW - screen.width) / 2,
              top: (innerH - screen.height) / 2,
              transform: [{ scale }],
            }}
          >
            {/* Gerçek ekranlardaki sıra (ScreenDecor): ambiyans → ikon deseni →
                atmosfer → içerik. Sönüklük yalnız atmosferde (güç düğmesi onun). */}
            <FadeLayer visible={ambient}>
              <AmbientLayer />
            </FadeLayer>
            <FadeLayer visible={icon}>
              <IconPattern opacity={PREVIEW_ICON_OPACITY} />
            </FadeLayer>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow }]}>
              <WeatherLayer playing={playing} genres={genres} effectOverride={effectOverride} />
            </Animated.View>
            {showContent ? (
              <MockScreen theme={theme} width={screen.width} height={screen.height} topInset={14} />
            ) : null}
          </View>
          <View style={pp.tools}>
            <GlassPressable
              onPress={onToggleContent}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={
                showContent
                  ? i18nText("autoI18n.atmosfer_icerik_gizle", "İçeriği gizle")
                  : i18nText("autoI18n.atmosfer_icerik_goster", "İçeriği göster")
              }
              style={pp.toolBtn}
            >
              <AppIcon name={showContent ? "eye-outline" : "eye-off-outline"} size={16} color="#ffffff" />
            </GlassPressable>
            <GlassPressable
              onPress={onToggleExpand}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={
                expanded
                  ? i18nText("autoI18n.atmosfer_kucult", "Küçült")
                  : i18nText("autoI18n.atmosfer_tam_ekran", "Tam ekran")
              }
              style={pp.toolBtn}
            >
              <AppIcon name={expanded ? "contract-outline" : "expand-outline"} size={16} color="#ffffff" />
            </GlassPressable>
          </View>
          <View style={[pp.island, { width: innerW * 0.3, height: islandH }]} />
          {/* Durum: adanın altında küçük hap (gerçek boyutta, ölçeklenmez). */}
          <View style={[pp.statusWrap, { top: 6 + islandH + 6 }]} pointerEvents="none">
            <View style={[pp.status, { backgroundColor: alpha("#000000", 0.55) }]}>
              <View style={[pp.dot, { backgroundColor: statusOn ? "#4ade80" : alpha("#ffffff", 0.55) }]} />
              <Text allowFontScaling={false} numberOfLines={1} style={pp.statusText}>
                {status}
              </Text>
            </View>
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              pp.flash,
              {
                opacity: flash,
                transform: [{ scale: flash.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              },
            ]}
          >
            <View style={[pp.flashDisc, { backgroundColor: on ? alpha(theme.accent, 0.92) : alpha("#000000", 0.6) }]}>
              <AppIcon name="power" size={30} color="#ffffff" />
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ── Telefonun yanları ──────────────────────────────────────────────────────

const SIDE_OPT_H = 34;
const SIDE_OPT_GAP = 4;
const SIDE_PAD = 4;

function SideTitle({ colors, children }) {
  return (
    <Text allowFontScaling={false} numberOfLines={2} style={[sd.title, { color: colors.muted }]}>
      {children}
    </Text>
  );
}

// Sol: dikey yoğunluk seçici. Vurgu seçilene yaylanarak kayar.
function SideDensity({ value, onChange, colors, count }) {
  const index = Math.max(0, DECOR_DENSITIES.indexOf(value));
  const y = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    Animated.spring(y, { toValue: index, speed: 18, bounciness: 7, useNativeDriver: true }).start();
  }, [index, y]);
  return (
    <View style={sd.column}>
      <SideTitle colors={colors}>{i18nText("autoI18n.atmosfer_yogunluk_kisa", "Yoğunluk")}</SideTitle>
      <View
        accessibilityRole="radiogroup"
        style={[sd.track, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            sd.indicator,
            {
              backgroundColor: colors.accent,
              transform: [
                {
                  translateY: y.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, SIDE_OPT_H + SIDE_OPT_GAP],
                  }),
                },
              ],
            },
          ]}
        />
        {DECOR_DENSITIES.map((d) => {
          const active = d === value;
          return (
            <GlassTouchable
              key={d}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              // Camsız: seçimi kayan vurgu gösterir; esneyen cam vurguyla
              // örtüşmez, kenarı kesik görünürdü.
              glass={false}
              style={sd.option}
              activeOpacity={0.7}
              onPress={() => {
                if (active) return;
                Haptics.selectionAsync();
                onChange(d);
              }}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[sd.optText, { color: active ? colors.white : colors.muted, fontWeight: active ? "700" : "500" }]}
              >
                {DENSITY_LABELS[d]()}
              </Text>
            </GlassTouchable>
          );
        })}
      </View>
      <Text allowFontScaling={false} numberOfLines={1} style={[sd.caption, { color: colors.muted }]}>
        {i18nText("autoI18n.atmosfer_parcacik_sayisi", "{{n}} parçacık").replace("{{n}}", String(count))}
      </Text>
    </View>
  );
}

// Sağ: dikey "detaylarda türe göre" anahtarı. Topuz aşağıdan yukarı kayar,
// iz vurgu rengiyle dolar.
const SW_W = 38;
const SW_H = 74;
const KNOB = 30;
function SideGenreSwitch({ value, onChange, colors, onInfo }) {
  const k = useRef(new Animated.Value(value ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(k, { toValue: value ? 1 : 0, speed: 16, bounciness: 8, useNativeDriver: true }).start();
  }, [value, k]);
  const travel = SW_H - KNOB - 8;
  return (
    <View style={sd.column}>
      <View style={sd.titleRow}>
        <SideTitle colors={colors}>{i18nText("autoI18n.atmosfer_ture_gore_kisa", "Türe göre")}</SideTitle>
        <GlassTouchable
          glass={false}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.atmosfer_tur_bilgi_a11y", "Türe göre nasıl çalışır?")}
          onPress={() => {
            Haptics.selectionAsync();
            onInfo();
          }}
          style={sd.infoBtn}
        >
          <AppIcon name="alert-circle-outline" size={15} color={colors.muted} />
        </GlassTouchable>
      </View>
      {/* Pay: basınca büyüyen iz komşusuna/kenara değmesin. İz CAMSIZ: kendi
          dolgusu ve topuzu var; esneyen cam dolguyla örtüşmez, açıkken kenarı
          kesik görünüyordu. Basma hissi kendi yayıyla. */}
      <View style={sd.switchRoom}>
        <GlassTouchable
          glass={false}
          activeOpacity={1}
          accessibilityRole="switch"
          accessibilityState={{ checked: value }}
          accessibilityLabel={i18nText("autoI18n.atmosfer_ture_gore", "Detaylarda türe göre")}
          onPressIn={() =>
            Animated.spring(press, { toValue: 0.9, speed: 40, bounciness: 0, useNativeDriver: true }).start()
          }
          onPressOut={() =>
            Animated.spring(press, { toValue: 1, speed: 14, bounciness: 12, useNativeDriver: true }).start()
          }
          onPress={() => {
            Haptics.selectionAsync();
            onChange(!value);
          }}
          style={sd.switchHit}
        >
          <Animated.View
            style={[
              sd.switchTrack,
              { backgroundColor: colors.cardAlt, borderColor: value ? colors.accent : colors.border, transform: [{ scale: press }] },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, sd.switchFill, { backgroundColor: colors.accent, opacity: k }]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                sd.knob,
                {
                  transform: [{ translateY: k.interpolate({ inputRange: [0, 1], outputRange: [travel, 0] }) }],
                },
              ]}
            >
              <AppIcon
                family="MaterialCommunityIcons"
                name="movie-filter-outline"
                size={16}
                color={value ? colors.accent : colors.muted}
              />
            </Animated.View>
          </Animated.View>
        </GlassTouchable>
      </View>
      <Text allowFontScaling={false} numberOfLines={1} style={[sd.caption, { color: value ? colors.accentStrong : colors.muted }]}>
        {value
          ? i18nText("autoI18n.atmosfer_durum_acik", "Açık")
          : i18nText("autoI18n.atmosfer_durum_kapali", "Kapalı")}
      </Text>
    </View>
  );
}

// ── Ekran ──────────────────────────────────────────────────────────────────

function CardHeader({ colors, icon, title, subtitle, badge, right }) {
  return (
    <View style={st.blockHeader}>
      <View style={[st.iconWrap, { backgroundColor: colors.iconTeal }]}>
        <AppIcon family={icon?.family} name={icon?.name} size={16} color={colors.teal} />
      </View>
      <View style={st.flex}>
        <Text allowFontScaling={false} style={[st.blockTitle, { color: colors.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text allowFontScaling={false} style={[st.blockSub, { color: colors.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge != null ? (
        <View style={[st.badge, { backgroundColor: colors.accentDim }]}>
          <Text allowFontScaling={false} style={[st.badgeText, { color: colors.accentStrong }]}>
            {badge}
          </Text>
        </View>
      ) : null}
      {right || null}
    </View>
  );
}

export default function AtmosphereScreen() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const { height: windowH } = useWindowDimensions();
  const isFocused = useIsFocused();
  const appActive = useAppActive();
  const reduceMotion = useReduceMotion();
  const effectMode = useEffectMode();
  const { showSnow, snowAllowed, changeShowSnow } = useSnowSettings();
  const {
    choice,
    effect,
    density,
    byGenre,
    specialDays,
    changeChoice,
    changeDensity,
    changeByGenre,
    changeSpecialDays,
  } = useWeatherSettings();
  // Arka plan katmanları: Free'de de önizlemede görünür (ne alacağını görür),
  // Premium'da yalnız açıksa.
  const { showAmbientBackground, ambientAllowed } = useAmbientBackgroundSettings();
  const { showIconBackground, iconBackgroundAllowed } = useIconBackgroundSettings();
  const previewAmbient = showAmbientBackground || !ambientAllowed;
  const previewIcon = showIconBackground || !iconBackgroundAllowed;
  const snowGate = usePremiumGate("snow_effect");
  const openUpsell = useCallback(() => snowGate.showUpsell(), [snowGate]);

  // Önizlemede denenen türler (yalnız bu ekranda; kaydedilmez).
  const [sampleGenres, setSampleGenres] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const toggleGenre = useCallback((id) => {
    Haptics.selectionAsync();
    setSampleGenres((prev) => {
      if (prev.includes(id)) return prev.filter((g) => g !== id);
      // En fazla GENRE_MIX_MAX: yenisi eklenince en eskisi düşer.
      return [...prev, id].slice(-GENRE_MIX_MAX);
    });
  }, []);
  // Önizlemede denenen özel gün (yalnız bu ekranda; kaydedilmez). Özel gün
  // seçiliyken tür örneği çizilmez (WeatherLayer da efekti öne alır).
  const [sampleDay, setSampleDay] = useState(null);
  const toggleDay = useCallback((id) => {
    Haptics.selectionAsync();
    setSampleDay((prev) => (prev === id ? null : id));
  }, []);
  const sampleDayEffect = specialDays && sampleDay ? SPECIAL_DAYS.find((s) => s.id === sampleDay)?.effect : undefined;
  const previewGenres = byGenre && sampleGenres.length && !sampleDayEffect ? sampleGenres : undefined;

  // Önizlemenin çizdiği efektler (rozet + "N parçacık" için).
  const plan = useMemo(() => {
    if (sampleDayEffect) return resolvePlan([sampleDayEffect], density, effectMode);
    const fromGenres = previewGenres ? genreEffectsFor(previewGenres) : [];
    return resolvePlan(fromGenres.length ? fromGenres : [effect], density, effectMode);
  }, [sampleDayEffect, previewGenres, effect, density, effectMode]);
  const particleCount = plan.reduce((sum, [, c]) => sum + c, 0);

  const lang = copyLanguage(language, LANGS);
  const frameHeight = Math.round(Math.max(260, Math.min(440, windowH * 0.45)));
  const playing = isFocused && appActive && !reduceMotion;
  const [fullscreen, setFullscreen] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const toggleContent = useCallback(() => {
    Haptics.selectionAsync();
    setShowContent((v) => !v);
  }, []);
  const toggleFullscreen = useCallback(() => {
    Haptics.selectionAsync();
    setFullscreen((v) => !v);
  }, []);
  const fullHeight = Math.round(Math.max(frameHeight, windowH - 110));

  const statusText = reduceMotion
    ? i18nText("autoI18n.atmosfer_onizleme_hareket", "Hareketi Azalt açık · önizleme duraklatıldı")
    : !snowAllowed
      ? i18nText("autoI18n.atmosfer_onizleme_premium", "Premium · açmak için dokun")
      : !showSnow
        ? i18nText("autoI18n.atmosfer_onizleme_kapali", "Kapalı · açmak için dokun")
        : sampleDayEffect
          ? i18nText("autoI18n.atmosfer_onizleme_ozel_gun", "Özel gün önizlemesi · o gün böyle")
          : previewGenres
            ? i18nText("autoI18n.atmosfer_onizleme_tur", "Tür önizlemesi · detay ekranında böyle")
            : weatherChoiceLabel(choice, effect);

  // Telefona dokun = aç/kapa. Free'de anahtar oynamaz, yükseltme sayfası gelir.
  const togglePower = useCallback(() => {
    if (!snowAllowed) {
      openUpsell();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Light);
    changeShowSnow(!showSnow);
  }, [snowAllowed, openUpsell, changeShowSnow, showSnow]);

  return (
    <SettingsSubScreen title={t.snow} scrollable={false} decorEffects={NO_SCREEN_DECOR}>
      <View style={st.previewArea}>
        <SideDensity value={density} onChange={changeDensity} colors={C} count={particleCount} />
        <PhonePreview
          theme={theme}
          frameHeight={frameHeight}
          playing={playing && !fullscreen}
          genres={previewGenres}
          effectOverride={sampleDayEffect}
          on={showSnow}
          // Free'de sönük değil: ne alacağını tam görsün.
          dim={snowAllowed && !showSnow}
          ambient={previewAmbient}
          icon={previewIcon}
          status={statusText}
          statusOn={showSnow && !reduceMotion}
          onPress={togglePower}
          a11y={{
            label: t.snow,
            hint: i18nText("autoI18n.atmosfer_dokun_ipucu", "Açmak ya da kapatmak için dokun"),
          }}
          showContent={showContent}
          onToggleContent={toggleContent}
          expanded={false}
          onToggleExpand={toggleFullscreen}
        />
        <SideGenreSwitch value={byGenre} onChange={changeByGenre} colors={C} onInfo={() => setInfoOpen(true)} />
      </View>

      <ScrollView
        style={st.flex}
        contentContainerStyle={st.controls}
        showsVerticalScrollIndicator={false}
      >
        <GlassBox role="card" style={[st.card, st.cardPadded, { backgroundColor: C.card, borderColor: C.border }]}>
          <CardHeader
            colors={C}
            icon={WEATHER_ICONS[choice]}
            title={i18nText("autoI18n.atmosfer_efekt_baslik", "Efekt")}
            subtitle={
              choice === "auto"
                ? i18nText("autoI18n.hava_tur_alt_otomatik", "Mevsime ve özel günlere göre · şu an {{name}}").replace(
                    "{{name}}",
                    weatherChoiceLabel(effect, effect),
                  )
                : i18nText("autoI18n.hava_tur_alt", "Ekranlarının arka planında ne olsun")
            }
          />
          <WeatherPicker value={choice} onChange={changeChoice} colors={C} />
        </GlassBox>

        {/* Türe göre açıkken: önizlemede tür dene (kaydedilmez). */}
        {byGenre ? (
          <GlassBox role="card" style={[st.card, st.cardPadded, { backgroundColor: C.card, borderColor: C.border }]}>
            <CardHeader
              colors={C}
              icon={{ family: "MaterialCommunityIcons", name: "movie-filter-outline" }}
              title={i18nText("autoI18n.atmosfer_tur_dene", "Önizlemede dene · en fazla 3 tür")}
              subtitle={i18nText(
                "autoI18n.atmosfer_ture_gore_alt",
                "Aksiyonda kıvılcım, romantikte kalp, korkuda yarasa…",
              )}
            />
            <ChipRow
              colors={C}
              items={SAMPLE_GENRES.map(([key, id]) => ({
                key,
                role: "checkbox",
                label: GENRE_LABELS[key][lang],
                icon: GENRE_ICONS[key],
                active: sampleGenres.includes(id),
                onPress: () => toggleGenre(id),
              }))}
            />
          </GlassBox>
        ) : null}

        {/* Özel günler (türe göre kartıyla aynı düzen): anahtar + açıkken önizlemede
            gün dene (kaydedilmez). Sabit tarihli günlerde atmosfer güne uyar. */}
        <GlassBox role="card" style={[st.card, st.cardPadded, { backgroundColor: C.card, borderColor: C.border }]}>
          <CardHeader
            colors={C}
            icon={{ family: "MaterialCommunityIcons", name: "calendar-star" }}
            title={i18nText("autoI18n.atmosfer_ozel_gunler", "Özel günler")}
            subtitle={
              specialDays
                ? i18nText("autoI18n.atmosfer_ozel_dene", "Önizlemede dene · bir gün seç")
                : i18nText(
                    "autoI18n.atmosfer_ozel_gunler_alt",
                    "Yılbaşı, Sevgililer Günü, Cadılar Bayramı… günü gelince atmosfer ona uyar",
                  )
            }
            right={<SwitchToggle value={specialDays} onValueChange={changeSpecialDays} size={36} />}
          />
          {specialDays ? (
            <ChipRow
              colors={C}
              items={SPECIAL_DAYS.map(({ id }) => ({
                key: id,
                role: "radio",
                label: SPECIAL_DAY_LABELS[id](),
                icon: SPECIAL_DAY_ICONS[id],
                active: sampleDay === id,
                onPress: () => toggleDay(id),
              }))}
            />
          ) : null}
        </GlassBox>

        {/* Arka plan katmanları: atmosferin ARKASINDA çizilir, önizlemede
            birlikte görünür. */}
        <Text allowFontScaling={false} style={[st.sectionLabel, { color: C.muted }]}>
          {i18nText("autoI18n.atmosfer_katmanlar_baslik", "Arka plan katmanları")}
        </Text>
        <AmbientLayerCard colors={C} />
        <IconLayerCard colors={C} />
        <RegenerateBackgroundCard colors={C} />

        {/* Hangi ekranlarda görünsün: atmosfer + iki katmanın ekran grubu süzgeci
            (DecorScopesScreen). Eskiden Kişiselleştirme'de ayrı satırdı. */}
        <Text allowFontScaling={false} style={[st.sectionLabel, { color: C.muted }]}>
          {i18nText("autoI18n.atmosfer_nerede_baslik", "Nerede görünsün")}
        </Text>
        <DecorScopesCard colors={C} />
      </ScrollView>
      <Modal
        visible={fullscreen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={st.fullBackdrop}>
          {fullscreen ? (
            <PhonePreview
              theme={theme}
              frameHeight={fullHeight}
              playing={playing}
              genres={previewGenres}
              effectOverride={sampleDayEffect}
              on={showSnow}
              dim={snowAllowed && !showSnow}
              ambient={previewAmbient}
              icon={previewIcon}
              status={statusText}
              statusOn={showSnow && !reduceMotion}
              onPress={togglePower}
              a11y={{
                label: t.snow,
                hint: i18nText("autoI18n.atmosfer_dokun_ipucu", "Açmak ya da kapatmak için dokun"),
              }}
              showContent={showContent}
              onToggleContent={toggleContent}
              expanded
              onToggleExpand={toggleFullscreen}
            />
          ) : null}
        </View>
      </Modal>
      <AtmosphereGenreInfoSheet visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </SettingsSubScreen>
  );
}

const pp = StyleSheet.create({
  frame: {
    backgroundColor: "#0b0b10",
    padding: BEZEL,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  screen: { overflow: "hidden" },
  statusWrap: { position: "absolute", left: 6, right: 6, alignItems: "center" },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    maxWidth: "100%",
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9.5, fontWeight: "700", color: "#ffffff", flexShrink: 1 },
  flash: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  flashDisc: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  tools: { position: "absolute", right: 8, bottom: 8, flexDirection: "row", gap: 6 },
  toolBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  island: {
    position: "absolute",
    top: 6,
    alignSelf: "center",
    borderRadius: 99,
    backgroundColor: "#000",
  },
});

const ms = StyleSheet.create({
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 30,
    height: 34,
  },
  clock: { fontSize: 16, fontWeight: "700" },
  statusIcons: { flexDirection: "row", alignItems: "center", gap: 6 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 16,
  },
  titleBar: { width: 150, height: 26, borderRadius: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  hero: {
    marginHorizontal: 16,
    height: 210,
    borderRadius: 22,
    padding: 18,
    justifyContent: "flex-end",
    gap: 8,
  },
  heroLine: { height: 12, borderRadius: 6 },
  rail: { marginTop: 22, paddingHorizontal: 16 },
  railTitle: { width: 130, height: 14, borderRadius: 7, marginBottom: 12 },
  posters: { flexDirection: "row", gap: 10 },
  poster: { borderRadius: 12, borderWidth: 1 },
  tabBar: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
});

const st = StyleSheet.create({
  flex: { flex: 1 },
  fullBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", alignItems: "center", justifyContent: "center" },
  previewArea: { flexDirection: "row", alignItems: "center", paddingTop: 4, paddingBottom: 14, gap: 12 },
  controls: { paddingBottom: 110, gap: 12 },
  card: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  cardPadded: { padding: 16, gap: 12 },
  blockHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  blockTitle: { fontSize: 14, fontWeight: "500" },
  blockSub: { fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 6,
    marginLeft: 4,
    marginBottom: -4,
  },
});

const sd = StyleSheet.create({
  column: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, minWidth: 0 },
  title: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  track: {
    width: "100%",
    maxWidth: 84,
    padding: SIDE_PAD,
    gap: SIDE_OPT_GAP,
    borderRadius: 16,
    borderWidth: 1,
  },
  indicator: {
    position: "absolute",
    top: SIDE_PAD,
    left: SIDE_PAD,
    right: SIDE_PAD,
    height: SIDE_OPT_H,
    borderRadius: 12,
  },
  option: {
    height: SIDE_OPT_H,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  optText: { fontSize: 11, textAlign: "center" },
  caption: { fontSize: 10.5, fontWeight: "600", textAlign: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  infoBtn: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  switchRoom: { padding: GLASS_PRESS_ROOM / 2 },
  switchHit: { padding: 4 },
  switchTrack: {
    width: SW_W,
    height: SW_H,
    borderRadius: SW_W / 2,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    paddingTop: 3,
  },
  switchFill: { borderRadius: SW_W / 2 },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
