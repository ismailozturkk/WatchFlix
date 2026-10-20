// components/storyShare/ProfileStoryModal.js
//
// Profil ekranındaki "Hikâyede paylaş" düzenleyicisi: gerçek profil verisinden
// 9:16 kart çizer, canlı önizler, özelleştirtir ve 1080x1920 olarak paylaştırır /
// galeriye kaydeder.
//
// Önceki sürüm film bağlamı için yazılmış şablonları (bilet, polaroid…) profile
// veri vermeden açıyordu: kartlar "Film Adı" yer tutucusuyla ve boş Top 4 ile
// çıkıyordu. Şimdi kart profilin kendi verisinden (avatar, ad, istatistik, Perde,
// rozetler, favoriler/izlenenler) beslenir; film bağlamlı paylaşım zaten
// StoryShareScreen'de.
//
// Yapı: önizleme hep görünür; altında üç sekme (Düzen / Renk / İçerik) sabit
// yükseklikli bir panelde değişir — sayfa yüksekliği sekmeyle zıplamaz. Not
// alanı sekmelerin DIŞINDA, önizlemenin hemen altında: klavye açılınca yalnız
// önizleme + not alanı kalır (kalanı gizlenir, odak kaybolmasın diye
// unmount edilmez).
//
// Geri bildirim sayfa İÇİNDE (banner): paylaş/kaydet sonucu, işlemi başlatan düğmenin
// hemen yanında okunur. (Sayfa bir BottomSheetModal olduğu için toast da görünürdü —
// bkz. components/toast/ToastHost.js — ama banner bağlamı korur.)
//
// Seçimler (düzen/renk/poster kaynağı/anahtarlar) MMKV'de hatırlanır; not
// hatırlanmaz (Keys.profileStoryCard, utils/profileStoryCard.js).

import { intlLocaleOf } from "../../utils/appLanguages";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheetModal from "../common/BottomSheetModal";
import AppIcon from "../AppIcon";
import GlassIconButton from "../common/GlassIconButton";
import GlassCloseButton from "../common/GlassCloseButton";
import ProfileStoryCard, {
  STORY_CARD_H,
  STORY_CARD_W,
  getStoryPalette,
} from "./ProfileStoryCard";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useProfileStats } from "../../context/ProfileStatsContext";
import { useWatchProgressContext } from "../../context/WatchProgressContext";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { SHEET_TOP_MARGIN } from "../../utils/sheetKeyboardFit";
import { getFavoritesCopy } from "../../utils/favoritesCopy";
import { FAVORITE_KINDS, countFavorites } from "../../utils/fourFavorites";
import { triggerHaptic } from "../../services/hapticsService";
import { Keys, get, set } from "../../services/storage";
import {
  captureStoryCard,
  saveStoryToGallery,
  shareStoryImage,
} from "../../services/storyShare/storyShareService";
import {
  DEFAULT_PROFILE_STORY_OPTIONS,
  STORY_CAPTURE,
  STORY_LAYOUT_IDS,
  STORY_NOTE_MAX,
  STORY_POSTER_COUNT,
  STORY_THEME_IDS,
  buildStoryGenres,
  buildStoryPerde,
  buildStoryStats,
  buildStoryStreak,
  cleanStoryNote,
  formatMemberSince,
  isFavoritesActive,
  persistableStoryOptions,
  pickShowcaseBadges,
  pickStoryFavorites,
  pickStoryPosters,
  resolveStoryLayout,
  sanitizeStoryOptions,
  toStoryBadge,
  toggleStoryKind,
} from "../../utils/profileStoryCard";
import GlassPressable from "../common/GlassPressable";
import GlassBox from "../common/GlassBox";

const TABS = [
  { id: "layout", icon: "grid-outline", label: () => i18nText("autoI18n.profil_story_sekme_duzen", "Düzen") },
  { id: "color", icon: "color-palette-outline", label: () => i18nText("autoI18n.profil_story_sekme_renk", "Renk") },
  { id: "content", icon: "options-outline", label: () => i18nText("autoI18n.profil_story_sekme_icerik", "İçerik") },
];

const LAYOUT_LABELS = {
  showcase: () => i18nText("autoI18n.profil_story_duzen_vitrin", "Vitrin"),
  identity: () => i18nText("autoI18n.profil_story_duzen_kimlik", "Kimlik"),
  wall: () => i18nText("autoI18n.profil_story_duzen_duvar", "Duvar"),
  minimal: () => i18nText("autoI18n.profil_story_duzen_minimal", "Minimal"),
  picks: () => i18nText("autoI18n.profil_story_duzen_secki", "Seçki"),
};
const LAYOUTS = STORY_LAYOUT_IDS.map((id) => ({ id, label: LAYOUT_LABELS[id] }));

const THEME_LABELS = {
  signature: () => i18nText("autoI18n.profil_story_tema_imza", "İmza"),
  sunset: () => i18nText("autoI18n.profil_story_tema_gunbatimi", "Gün batımı"),
  ocean: () => i18nText("autoI18n.profil_story_tema_okyanus", "Okyanus"),
  forest: () => i18nText("autoI18n.profil_story_tema_orman", "Orman"),
  gold: () => i18nText("autoI18n.profil_story_tema_altin", "Altın"),
  noir: () => i18nText("autoI18n.profil_story_tema_noir", "Noir"),
  rank: () => i18nText("autoI18n.profil_story_tema_halka", "Halka"),
};
// Wrapped paletleri + avatar halkasının rengi ("rank").
const THEME_ITEMS = STORY_THEME_IDS.map((id) => ({ id }));

const SOURCES = [
  { id: "favorites", label: () => i18nText("autoI18n.profil_story_kaynak_favoriler", "Favoriler") },
  { id: "movies", label: () => i18nText("autoI18n.profil_story_kaynak_filmler", "Filmler") },
  { id: "shows", label: () => i18nText("autoI18n.profil_story_kaynak_diziler", "Diziler") },
];

// İki satıra bölünür (yatay kaydırmalı ızgara): üstte dört, altta kalanlar.
// `needs`: bu anahtarın göstereceği veri yoksa düğme pasif kalır (boş kart
// bölümü çizilmez, kullanıcı da neden çalışmadığını görür).
const TOGGLES = [
  { key: "showStats", icon: "stats-chart-outline", label: () => i18nText("autoI18n.profil_story_ogr_istatistik", "İstatistik") },
  { key: "showPerde", icon: "film-outline", needs: "perde", label: () => i18nText("autoI18n.profil_story_ogr_perde", "Perde") },
  { key: "showGenres", icon: "pie-chart-outline", needs: "genres", label: () => i18nText("autoI18n.profil_story_ogr_tur", "Türler") },
  { key: "showStreak", icon: "flame-outline", needs: "streak", label: () => i18nText("autoI18n.profil_story_ogr_seri", "Seri") },
  { key: "showPosters", icon: "images-outline", needs: "posters", label: () => i18nText("autoI18n.profil_story_ogr_poster", "Poster") },
  { key: "showFavorites", icon: "star-outline", needs: "favorites", label: () => i18nText("autoI18n.profil_story_ogr_dort_fav", "Dört favori") },
  { key: "showBadges", icon: "ribbon-outline", needs: "badges", label: () => i18nText("autoI18n.profil_story_ogr_rozet", "Rozetler") },
  { key: "showMember", icon: "calendar-outline", needs: "member", label: () => i18nText("autoI18n.profil_story_ogr_uyelik", "Üyelik") },
  { key: "showUsername", icon: "at-outline", label: () => i18nText("autoI18n.profil_story_ogr_kullanici", "Kullanıcı adı") },
];
const TOGGLE_ROWS = [TOGGLES.slice(0, 4), TOGGLES.slice(4)];

// Önizleme dışındaki dikey ayrılan alan (tutamaç, başlık, not alanı, sekmeler,
// panel, eylem çubuğu, boşluklar) — yeni bir satır eklenirse BURAYI güncelle,
// yoksa önizleme sayfayı taşırır. PANEL_H içerik sekmesine göre ölçülür:
// kaynak anahtarı 36 + boşluk 10 + iki satır anahtar (2×36 + 8) = 126, eylem
// çubuğundan 6 pay ayrılır → 132.
const CHROME_H = 416;
const PANEL_H = 132;
const KEYBOARD_CHROME_H = 214;

const noFavoritesText = () =>
  i18nText(
    "autoI18n.profil_story_fav_yok",
    "Henüz dört favorin yok. Profili Düzenle'den ekleyebilirsin.",
  );

// Önizleme üstündeki geri bildirim bandı: başarı, hata ve "neden pasif" bilgisi.
const FEEDBACK_TONE = { success: "#067647", error: "#B42318", info: "#344054" };
const FEEDBACK_ICON = { success: "checkmark-circle", error: "alert-circle", info: "information-circle" };

// ── Küçük denetim parçaları ──────────────────────────────────────────────────

const Segmented = memo(function Segmented({ theme, items, value, onChange }) {
  return (
    <View style={[styles.segmented, { backgroundColor: theme.secondary, borderColor: alpha(theme.border, 0.8) }]}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <GlassPressable
            key={item.id}
            onPress={() => onChange(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segmentedItem, active && { backgroundColor: theme.accent }]}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.segmentedText, { color: active ? "#FFFFFF" : theme.text.secondary }]}
            >
              {item.label()}
            </Text>
          </GlassPressable>
        );
      })}
    </View>
  );
});

// Segmented'in çoklu seçimli kardeşi: birden çok parça aynı anda dolu olabilir.
// `disabled` parça (ör. boş kategori) soluk çizilir ama basışı yine iletir.
const MultiSegmented = memo(function MultiSegmented({ theme, items, selected, onToggle }) {
  return (
    <View style={[styles.segmented, { backgroundColor: theme.secondary, borderColor: alpha(theme.border, 0.8) }]}>
      {items.map((item) => {
        const active = selected.includes(item.id);
        return (
          <GlassPressable
            key={item.id}
            onPress={() => onToggle(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: !!item.disabled }}
            style={[
              styles.segmentedItem,
              active && { backgroundColor: theme.accent },
              item.disabled && { opacity: 0.4 },
            ]}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.segmentedText, { color: active ? "#FFFFFF" : theme.text.secondary }]}
            >
              {item.label}
            </Text>
          </GlassPressable>
        );
      })}
    </View>
  );
});

// Küçük tel kafes: kullanıcı düzeni adından önce şeklinden tanısın.
const Block = ({ l, t, w, h, r = 2, o = 1, color, round }) => (
  <View
    style={{
      position: "absolute",
      left: l,
      top: t,
      width: w,
      height: h,
      borderRadius: round ? w / 2 : r,
      backgroundColor: color,
      opacity: o,
    }}
  />
);

function LayoutThumb({ id, color }) {
  const frame = { backgroundColor: alpha(color, 0.1), borderColor: alpha(color, 0.25) };
  return (
    <View style={[styles.thumb, frame]}>
      {/* Vitrin: kimlik satırı, Perde çubuğu, bento karoları, poster şeridi */}
      {id === "showcase" && (
        <>
          <Block l={5} t={5} w={10} h={10} round color={color} />
          <Block l={18} t={7} w={20} h={3} color={color} />
          <Block l={18} t={12} w={12} h={2} color={color} o={0.5} />
          <Block l={5} t={19} w={42} h={6} r={3} color={color} o={0.4} />
          <Block l={5} t={28} w={23} h={15} r={3} color={color} o={0.75} />
          <Block l={30} t={28} w={17} h={15} r={3} color={color} o={0.45} />
          <Block l={5} t={46} w={25} h={11} r={3} color={color} o={0.45} />
          <Block l={32} t={46} w={15} h={11} r={3} color={color} o={0.6} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Block key={`p${i}`} l={5 + i * 8.6} t={62} w={7} h={11} r={1.5} color={color} o={0.85} />
          ))}
        </>
      )}
      {/* Kimlik: üstte binen avatarlı üyelik kartı + poster yelpazesi */}
      {id === "identity" && (
        <>
          <Block l={5} t={12} w={42} h={40} r={7} color={color} o={0.25} />
          <Block l={18} t={5} w={16} h={16} round color={color} />
          <Block l={14} t={25} w={24} h={3} color={color} />
          <Block l={20} t={30} w={12} h={2} color={color} o={0.5} />
          <Block l={12} t={36} w={28} h={7} r={2} color={color} o={0.8} />
          <Block l={8} t={46} w={36} h={3} r={1.5} color={color} o={0.45} />
          <Block l={9} t={56} w={11} h={16} r={2} color={color} o={0.6} />
          <Block l={20} t={54} w={12} h={19} r={2} color={color} />
          <Block l={32} t={56} w={11} h={16} r={2} color={color} o={0.6} />
        </>
      )}
      {/* Duvar: eğik poster kolajı, altında avatar ve karolar */}
      {id === "wall" && (
        <>
          <View style={{ position: "absolute", left: -6, top: -8, width: 66, height: 52, transform: [{ rotate: "-9deg" }] }}>
            {[0, 1, 2, 3].map((i) => (
              <Block key={`a${i}`} l={4 + i * 15} t={i % 2 ? 0 : 6} w={13} h={19} r={2} color={color} o={0.7} />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <Block key={`b${i}`} l={4 + i * 15} t={i % 2 ? 22 : 28} w={13} h={19} r={2} color={color} o={0.45} />
            ))}
          </View>
          <Block l={5} t={35} w={14} h={14} round color={color} />
          <Block l={22} t={38} w={20} h={3} color={color} />
          <Block l={22} t={43} w={12} h={2} color={color} o={0.5} />
          <Block l={5} t={53} w={42} h={8} r={3} color={color} o={0.45} />
          <Block l={5} t={64} w={42} h={6} r={3} color={color} o={0.3} />
        </>
      )}
      {/* Minimal: dev sayı + satır satır sayaçlar */}
      {id === "minimal" && (
        <>
          <Block l={5} t={6} w={9} h={9} round color={color} />
          <Block l={17} t={8} w={16} h={3} color={color} o={0.7} />
          <Block l={5} t={22} w={40} h={14} r={2} color={color} />
          <Block l={5} t={39} w={14} h={2} color={color} o={0.5} />
          {[0, 1, 2].map((i) => (
            <View key={`r${i}`}>
              <Block l={5} t={47 + i * 8} w={42} h={1} color={color} o={0.3} />
              <Block l={5} t={50 + i * 8} w={12} h={2} color={color} o={0.5} />
              <Block l={36} t={49 + i * 8} w={11} h={4} r={1} color={color} o={0.9} />
            </View>
          ))}
          <Block l={5} t={72} w={42} h={3} r={1.5} color={color} o={0.35} />
        </>
      )}
      {/* Seçki: kimlik satırı, üç kategori rafı (4'er poster), istatistik şeridi */}
      {id === "picks" && (
        <>
          <Block l={5} t={5} w={9} h={9} round color={color} />
          <Block l={17} t={7} w={18} h={3} color={color} />
          <Block l={17} t={12} w={10} h={2} color={color} o={0.5} />
          {[0, 1, 2].map((row) => (
            <View key={`s${row}`}>
              <Block l={5} t={22 + row * 16} w={5} h={5} round color={color} o={0.55} />
              {[0, 1, 2, 3].map((i) => (
                <Block key={`p${row}${i}`} l={13 + i * 9.5} t={19 + row * 16} w={8} h={12} r={row === 2 ? 4 : 1.5} color={color} o={row === 2 ? 0.55 : 0.85} />
              ))}
            </View>
          ))}
          <Block l={5} t={67} w={42} h={6} r={3} color={color} o={0.4} />
        </>
      )}
    </View>
  );
}

// `disabled`: düzen şu an çizilemiyor (Seçki, favori yokken). Basış yine
// `onPress`e gider — çağıran nedenini söyleyen bir bildirim gösterir.
const LayoutCard = memo(function LayoutCard({ theme, item, active, disabled, onPress }) {
  const color = active ? theme.accent : theme.text.muted;
  return (
    <GlassPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      style={[
        styles.layoutCard,
        {
          backgroundColor: active ? alpha(theme.accent, 0.14) : theme.secondary,
          borderColor: active ? alpha(theme.accent, 0.7) : alpha(theme.border, 0.8),
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <LayoutThumb id={item.id} color={color} />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.layoutLabel, { color: active ? theme.accent : theme.text.secondary }]}
      >
        {item.label()}
      </Text>
    </GlassPressable>
  );
});

const Swatch = memo(function Swatch({ theme, item, accent, ringColors, active, onPress }) {
  const palette = getStoryPalette(item.id, accent, ringColors);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={THEME_LABELS[item.id]()}
      style={styles.swatchWrap}
    >
      <View
        style={[
          styles.swatchRing,
          { borderColor: active ? palette.accent : "transparent" },
        ]}
      >
        <LinearGradient
          colors={palette.colors}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.swatch}
        >
          <View style={[styles.swatchDot, { backgroundColor: palette.accent }]} />
          {active ? <AppIcon family="Ionicons" name="checkmark" size={16} color="#FFFFFF" /> : null}
        </LinearGradient>
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.swatchLabel, { color: active ? theme.text.primary : theme.text.muted }]}
      >
        {THEME_LABELS[item.id]()}
      </Text>
    </Pressable>
  );
});

// Pasif düğme de basışı iletir: çağıran, nedenini söyleyen bir bildirim gösterebilir
// ("Henüz dört favorin yok"). Pasifken DEĞER değiştirmek çağıranın sorumluluğu.
const ToggleChip = memo(function ToggleChip({ theme, item, on, disabled, onPress }) {
  return (
    <GlassPressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled }}
      style={[
        styles.toggleChip,
        {
          backgroundColor: on ? alpha(theme.accent, 0.16) : theme.secondary,
          borderColor: on ? alpha(theme.accent, 0.6) : alpha(theme.border, 0.8),
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <AppIcon
        family="Ionicons"
        name={on ? "checkmark-circle" : item.icon}
        size={15}
        color={on ? theme.accent : theme.text.muted}
      />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.toggleText, { color: on ? theme.accent : theme.text.secondary }]}
      >
        {item.label()}
      </Text>
    </GlassPressable>
  );
});

// ── Düzenleyici ──────────────────────────────────────────────────────────────

function ProfileStoryEditor({ onClose, name, username, avatar, isCustomPhoto, badges, bio, joinedAt, favorites }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { getTmdbUrl } = useImageQualitySettings();
  const stats = useProfileStats();
  const watchProgress = useWatchProgressContext();
  const cardRef = useRef(null);
  const feedbackTimer = useRef(null);

  const [options, setOptions] = useState(() => sanitizeStoryOptions(get(Keys.profileStoryCard)));
  const [noteDraft, setNoteDraft] = useState(() => cleanStoryNote(bio));
  const [tab, setTab] = useState("layout");
  const [busy, setBusy] = useState(null); // "share" | "save" | null
  const [feedback, setFeedback] = useState(null); // { type, text } | null
  const [keyboardH, setKeyboardH] = useState(0);
  const [loaded, setLoaded] = useState({});
  const [giveUp, setGiveUp] = useState(false);

  // Seçimleri hatırla (not hariç).
  useEffect(() => {
    try {
      set(Keys.profileStoryCard, persistableStoryOptions(options));
    } catch {
      // Kalıcılık başarısız olsa da düzenleyici çalışmaya devam eder.
    }
  }, [options]);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) => setKeyboardH(e?.endCoordinates?.height || 1));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardH(0));
    return () => {
      showSub.remove();
      hideSub.remove();
      clearTimeout(feedbackTimer.current);
    };
  }, []);

  const update = useCallback((patch) => {
    triggerHaptic("selection");
    setOptions((current) => sanitizeStoryOptions({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => {
    triggerHaptic("selection");
    setOptions(sanitizeStoryOptions(DEFAULT_PROFILE_STORY_OPTIONS));
    setNoteDraft(cleanStoryNote(bio));
  }, [bio]);

  const showFeedback = useCallback((type, text) => {
    clearTimeout(feedbackTimer.current);
    setFeedback({ type, text });
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2800);
  }, []);

  // ── Etkileşimler: pasif düğmeler NEDENİNİ söyler ──
  // Pasif ≠ ölü düğme: dokununca kullanıcı neden çalışmadığını bandta görür.
  const blockedReason = (item) => {
    if (item.needs && !available[item.needs]) return item.key === "showFavorites" ? "noFavorites" : "noData";
    if (item.key === "showPosters" && favoritesActive) return "replaced";
    return null;
  };

  const onToggle = (item) => {
    const reason = blockedReason(item);
    if (reason === "noFavorites") return showFeedback("info", noFavoritesText());
    if (reason === "replaced") {
      return showFeedback(
        "info",
        i18nText("autoI18n.profil_story_poster_favde", "Dört favori açıkken posterlerin yerini favorilerin alır."),
      );
    }
    if (reason) return undefined;
    return update({ [item.key]: !options[item.key] });
  };

  const onPickLayout = (id) => {
    if (id === "picks" && !hasFavorites) return showFeedback("info", noFavoritesText());
    // Seçki favorileri gösterir: anahtar kapalıysa birlikte açılır.
    return update(id === "picks" ? { layout: id, showFavorites: true } : { layout: id });
  };

  const onToggleKind = (kind) => {
    if (countFavorites(favorites, kind) === 0) {
      return showFeedback("info", i18nText("autoI18n.profil_story_kategori_bos", "Bu kategoride favorin yok."));
    }
    const next = toggleStoryKind(options.favoriteKinds, kind, favorites);
    if (next.length === favoritePick.kinds.length && next.every((k, i) => k === favoritePick.kinds[i])) {
      return showFeedback(
        "info",
        i18nText("autoI18n.profil_story_kategori_son", "En az bir kategori açık kalmalı."),
      );
    }
    return update({ favoriteKinds: next });
  };

  // ── Veri ──
  const cardOptions = useMemo(
    () => ({ ...options, note: cleanStoryNote(noteDraft) }),
    [options, noteDraft],
  );

  const lists = stats.lists;
  const sources = useMemo(() => {
    const byName = Object.fromEntries(Array.isArray(lists) ? lists : []);
    return {
      favorites: byName.favorites,
      movies: byName.watchedMovies,
      shows: byName.watchedTv,
    };
  }, [lists]);

  const hasAnyPoster = useMemo(
    () => pickStoryPosters(sources, "favorites", 1).items.length > 0,
    [sources],
  );

  // ── Dört favori ──
  // `layoutId`: kartın GERÇEKTEN çizeceği düzen (Seçki favorisiz Vitrin'e düşer).
  const favoritesCopy = useMemo(() => getFavoritesCopy(language), [language]);
  const hasFavorites = useMemo(() => countFavorites(favorites) > 0, [favorites]);
  const favoritePick = useMemo(
    () => pickStoryFavorites(favorites, options.favoriteKinds),
    [favorites, options.favoriteKinds],
  );
  const favoritesActive = isFavoritesActive(options, favoritePick);
  const layoutId = resolveStoryLayout(options.layout, favoritesActive);

  // Kartın beklediği biçim: görsel adresleri ve büyük harfli kategori adları burada.
  const cardFavorites = useMemo(() => {
    if (!favoritesActive) return null;
    const locale = intlLocaleOf(language);
    return {
      count: favoritePick.count,
      groups: favoritePick.groups.map((group) => ({
        kind: group.kind,
        label: favoritesCopy.kinds[group.kind].label.toLocaleUpperCase(locale),
        items: group.items.map((item) => ({
          key: item.key,
          title: item.title,
          // 200: yuvalar kartta en çok ~110 piksel (Duvar hücresi) çizilir; 12 görselin
          // "original" indirilmemesi için liste postersinin 400'ünden küçük istenir.
          uri: item.imagePath
            ? getTmdbUrl(item.imagePath, group.kind === "people" ? "profile" : "poster", 200)
            : null,
        })),
      })),
    };
  }, [favoritesActive, favoritePick, favoritesCopy, language, getTmdbUrl]);

  // Rastgele düzen + renk: mevcut seçimden FARKLI bir çift seçer (aynısı çıkarsa
  // düğmeye basmak hiçbir şey değiştirmemiş gibi görünürdü). Seçki favorisiz
  // çizilemez → o durumda aday olmaz.
  const shuffle = useCallback(() => {
    const pick = (list, current) => {
      const others = list.filter((id) => id !== current);
      return others[Math.floor(Math.random() * others.length)] || current;
    };
    const layout = pick(
      STORY_LAYOUT_IDS.filter((id) => id !== "picks" || hasFavorites),
      layoutId,
    );
    update({
      layout,
      themeId: pick(STORY_THEME_IDS, options.themeId),
      ...(layout === "picks" ? { showFavorites: true } : null),
    });
  }, [update, layoutId, options.themeId, hasFavorites]);

  const posters = useMemo(() => {
    const pick = pickStoryPosters(
      sources,
      options.posterSource,
      STORY_POSTER_COUNT[layoutId] || 4,
    );
    return {
      source: pick.source,
      items: pick.items
        .map((item) => ({ ...item, uri: getTmdbUrl(item.imagePath, "poster", 400) }))
        .filter((item) => item.uri),
    };
  }, [sources, options.posterSource, layoutId, getTmdbUrl]);

  // Sayılar profildeki kartlarla AYNI kipte okunur (tekrarlı/tekrarsız): ham
  // sayaçlar kartta başka bir sayı gösterip profille çelişirdi.
  const cardStats = useMemo(() => {
    const base = buildStoryStats({
      movies: stats.displayMovieCount,
      shows: stats.displayTvCount,
      episodes: stats.displayEpisodesCount,
      totalMinutes: (stats.totalMinutesTime || 0) + (stats.totalMinutesTimeTv || 0),
    });
    const daysText = !base.days
      ? ""
      : base.remHours
        ? i18nText("autoI18n.profil_story_gun_saat", `${base.days} GÜN ${base.remHours} SAAT`, {
            d: base.days,
            h: base.remHours,
          })
        : i18nText("autoI18n.profil_story_gun", `${base.days} GÜN`, { d: base.days });
    return { ...base, daysText };
    // language: i18nText çağrıları dili içeriden okur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stats.displayMovieCount,
    stats.displayTvCount,
    stats.displayEpisodesCount,
    stats.totalMinutesTime,
    stats.totalMinutesTimeTv,
    language,
  ]);

  const perdeInfo = watchProgress?.perde;
  const perde = useMemo(() => {
    const info = buildStoryPerde(perdeInfo, language);
    if (!info) return null;
    return {
      ...info,
      label: i18nText("autoI18n.perde_kisaltma", `PERDE ${info.number}`, { n: info.number }),
      makaraLabel: info.makara
        ? i18nText("autoI18n.perde_makara", `${info.makara}. Makara`, { n: info.makara })
        : "",
    };
  }, [perdeInfo, language]);

  // En çok izlenen türler: film + dizi listelerinin başlıklarından.
  const genres = useMemo(
    () => buildStoryGenres([...(sources.movies || []), ...(sources.shows || [])], language),
    [sources, language],
  );

  const streak = useMemo(() => buildStoryStreak(watchProgress?.seriler), [watchProgress?.seriler]);

  const earnedBadges = watchProgress?.acikSayisi || 0;
  const totalBadges = watchProgress?.toplamRozet || 0;
  const badgeCards = watchProgress?.kartlar;
  const badgeInfo = useMemo(() => {
    const showcase = pickShowcaseBadges(badgeCards, 4).map(toStoryBadge);
    return showcase.length
      ? { earned: earnedBadges, total: totalBadges, showcase }
      : null;
  }, [badgeCards, earnedBadges, totalBadges]);

  const member = useMemo(() => formatMemberSince(joinedAt, language), [joinedAt, language]);

  // Her anahtarın göstereceği veri var mı? (yoksa düğme pasif.)
  const available = {
    perde: !!perde,
    genres: genres.top.length > 0,
    streak: !!streak,
    posters: hasAnyPoster,
    favorites: hasFavorites,
    badges: !!badgeInfo || (badges?.length || 0) > 0,
    member: !!member,
  };

  const borderColor = stats.borderColor;
  const borderColor2 = stats.borderColor2;
  const profileInfo = useMemo(
    () => ({
      name,
      username,
      avatar,
      isCustomPhoto,
      ringColors: borderColor && borderColor2 ? [borderColor, borderColor2] : null,
    }),
    [name, username, avatar, isCustomPhoto, borderColor, borderColor2],
  );

  const str = useMemo(
    () => ({
      brandSub: i18nText("autoI18n.profil_story_profil", "PROFİL"),
      member: i18nText("autoI18n.profil_story_uye", "ÜYE"),
      movies: i18nText("autoI18n.profil_story_film", "FİLM"),
      shows: i18nText("autoI18n.profil_story_dizi", "DİZİ"),
      episodes: i18nText("autoI18n.profil_story_bolum", "BÖLÜM"),
      hours: i18nText("autoI18n.profil_story_saat", "SAAT"),
      totalTime: i18nText("autoI18n.profil_story_toplam_sure", "TOPLAM SÜRE"),
      genres: i18nText("autoI18n.profil_story_turler", "EN ÇOK İZLENEN TÜRLER"),
      streak: i18nText("autoI18n.profil_story_seri", "SERİ"),
      streakRecord: i18nText("autoI18n.profil_story_seri_rekor", "REKOR"),
      dayUnit: i18nText("autoI18n.profil_story_gun_birim", "GÜN"),
      badges: i18nText("autoI18n.profil_story_rozetler", "ROZETLER"),
      cta: i18nText("autoI18n.profil_story_cta", "İzlediklerini sen de kaydet"),
      favTitle: i18nText("autoI18n.profil_story_baslik_dort_fav", "DÖRT FAVORİM"),
      posterTitle: {
        favorites: i18nText("autoI18n.profil_story_baslik_fav", "FAVORİLERİM"),
        movies: i18nText("autoI18n.profil_story_baslik_film", "SON İZLEDİĞİM FİLMLER"),
        shows: i18nText("autoI18n.profil_story_baslik_dizi", "SON İZLEDİĞİM DİZİLER"),
      },
    }),
    // language: i18nText çağrıları dili içeriden okur; dil değişince yeniden kur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  );

  // ── Poster hazır mı? ──
  // Yakalama, posterler indirilmeden alınırsa boş yuvalı kart çıkar. Gösterilen
  // posterlerin hepsi yüklenene (ya da 4,5 sn dolana — ağ yoksa sonsuza dek
  // beklemesin) kadar eylem düğmeleri bekletilir.
  const onImageSettled = useCallback((uri) => {
    setLoaded((current) => (current[uri] ? current : { ...current, [uri]: true }));
  }, []);

  // Bekleyeceğimiz görseller kartta GERÇEKTEN çizilenlerdir: dört favori açıksa
  // onlar (Duvar'da ilk 9'u), değilse poster alanı.
  const shownUris = useMemo(() => {
    if (cardFavorites) {
      const uris = cardFavorites.groups.flatMap((group) => group.items.map((item) => item.uri)).filter(Boolean);
      return layoutId === "wall" ? uris.slice(0, 9) : uris;
    }
    return options.showPosters ? posters.items.map((item) => item.uri) : [];
  }, [cardFavorites, layoutId, options.showPosters, posters]);
  const pendingKey = shownUris.filter((uri) => !loaded[uri]).join("|");

  useEffect(() => {
    setGiveUp(false);
    if (!pendingKey) return undefined;
    const id = setTimeout(() => setGiveUp(true), 4500);
    return () => clearTimeout(id);
  }, [pendingKey]);

  const ready = !pendingKey || giveUp;

  // ── Paylaş / kaydet ──
  const run = useCallback(
    async (kind) => {
      if (busy || !ready) return;
      Keyboard.dismiss();
      setBusy(kind);
      triggerHaptic("impact");
      try {
        const uri = await captureStoryCard(cardRef, STORY_CAPTURE);
        if (kind === "share") {
          await shareStoryImage(uri);
        } else {
          await saveStoryToGallery(uri);
          triggerHaptic("notification");
          showFeedback("success", i18nText("autoI18n.galeriye_kaydedildi", "Galeriye kaydedildi"));
        }
      } catch (e) {
        const title =
          kind === "share"
            ? i18nText("autoI18n.profil_story_acilamadi", "Paylaşım açılamadı")
            : i18nText("autoI18n.profil_story_kaydedilemedi", "Kaydedilemedi");
        showFeedback("error", e?.message ? `${title}: ${e.message}` : title);
      } finally {
        setBusy(null);
      }
    },
    [busy, ready, showFeedback],
  );

  // ── Ölçüler ──
  const typing = keyboardH > 0;
  // Yazarken sayfa klavyenin üstüne kadar çıkar; BottomSheetModal tepesini durum
  // çubuğunun altında tutmak için maxHeight'ı (ekran − klavye − üst güvenli alan)
  // ile sınırlar. Önizleme o payı da düşmezse içerik sınırı aşar ve alttaki not
  // kutusu klavyenin altında kalır.
  const previewH = typing
    ? Math.round(
        Math.max(
          120,
          Math.min(340, winH - keyboardH - KEYBOARD_CHROME_H - insets.top - SHEET_TOP_MARGIN),
        ),
      )
    : Math.round(Math.max(200, Math.min(470, winH * 0.94 - CHROME_H - insets.bottom)));
  const k = previewH / STORY_CARD_H;
  const frameW = Math.round(STORY_CARD_W * k);
  const accent = theme.accent;
  const hide = typing ? styles.hidden : null;

  return (
    <View style={[styles.body, { paddingBottom: insets.bottom + 12 }]}>
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      {/* Başlık */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: alpha(accent, 0.15) }]}>
          <AppIcon family="Ionicons" name="share-social" size={18} color={accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.title, { color: theme.text.primary }]}>
            {i18nText("autoI18n.profil_story_baslik", "Profilini paylaş")}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.subtitle, { color: theme.text.muted }]}>
            {i18nText("autoI18n.profil_story_alt", "Hikâye kartını özelleştir")}
          </Text>
        </View>
        <GlassIconButton
          icon="shuffle"
          iconSize={17}
          size={34}
          fallbackRadius={17}
          color={theme.text.secondary}
          fallbackStyle={{ backgroundColor: theme.secondary }}
          accessibilityLabel={i18nText("autoI18n.profil_story_karistir", "Karıştır")}
          onPress={shuffle}
        />
        <GlassIconButton
          icon="refresh"
          iconSize={17}
          size={34}
          fallbackRadius={17}
          color={theme.text.secondary}
          fallbackStyle={{ backgroundColor: theme.secondary }}
          accessibilityLabel={i18nText("autoI18n.profil_story_sifirla", "Sıfırla")}
          onPress={reset}
        />
        <GlassCloseButton
          size={34}
          fallbackRadius={17}
          iconSize={19}
          color={theme.text.secondary}
          backgroundColor={theme.secondary}
          onPress={onClose}
        />
      </View>

      {/* Canlı önizleme: kart 360x640 yerleşir, burada ölçeklenerek gösterilir. */}
      <Pressable onPress={Keyboard.dismiss} style={styles.previewArea}>
        <View
          style={[
            styles.previewFrame,
            { width: frameW, height: previewH, borderRadius: Math.round(34 * k), borderColor: alpha(theme.border, 0.9) },
          ]}
        >
          <View
            style={{
              width: STORY_CARD_W,
              height: STORY_CARD_H,
              transformOrigin: "top left",
              transform: [{ scale: k }],
            }}
          >
            <View ref={cardRef} collapsable={false} style={{ width: STORY_CARD_W, height: STORY_CARD_H }}>
              <ProfileStoryCard
                options={cardOptions}
                theme={theme}
                language={language}
                profile={profileInfo}
                badges={badges}
                badgeInfo={badgeInfo}
                stats={cardStats}
                perde={perde}
                genres={genres}
                streak={streak}
                member={member}
                posters={posters}
                favorites={cardFavorites}
                str={str}
                onImageSettled={onImageSettled}
              />
            </View>
          </View>
        </View>

        {feedback ? (
          <View
            pointerEvents="none"
            style={[
              styles.feedback,
              { backgroundColor: FEEDBACK_TONE[feedback.type] || FEEDBACK_TONE.success },
            ]}
          >
            <AppIcon
              family="Ionicons"
              name={FEEDBACK_ICON[feedback.type] || FEEDBACK_ICON.success}
              size={16}
              color="#FFFFFF"
            />
            <Text allowFontScaling={false} numberOfLines={2} style={styles.feedbackText}>
              {feedback.text}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {/* Not: sekmelerin dışında; yazarken önizleme küçülür, bu alan görünür kalır. */}
      <GlassBox role="field" style={[styles.noteBox, { backgroundColor: theme.secondary, borderColor: alpha(theme.border, 0.8) }]}>
        <AppIcon family="Ionicons" name="chatbox-ellipses-outline" size={17} color={theme.text.muted} />
        <TextInput
          value={noteDraft}
          onChangeText={setNoteDraft}
          placeholder={i18nText("autoI18n.profil_story_not_yer", "Karta kısa bir not ekle…")}
          placeholderTextColor={theme.text.muted}
          maxLength={STORY_NOTE_MAX}
          returnKeyType="done"
          allowFontScaling={false}
          style={[styles.noteInput, { color: theme.text.primary }]}
        />
        {noteDraft ? (
          <Pressable onPress={() => setNoteDraft("")} hitSlop={8} accessibilityRole="button">
            <AppIcon family="Ionicons" name="close-circle" size={18} color={theme.text.muted} />
          </Pressable>
        ) : null}
      </GlassBox>

      {/* Sekmeler */}
      <View style={[styles.tabs, hide]}>
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <GlassPressable
              key={item.id}
              onPress={() => {
                triggerHaptic("selection");
                setTab(item.id);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? alpha(accent, 0.16) : "transparent",
                  borderColor: active ? alpha(accent, 0.55) : "transparent",
                },
              ]}
            >
              <AppIcon family="Ionicons" name={item.icon} size={16} color={active ? accent : theme.text.muted} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[styles.tabText, { color: active ? accent : theme.text.secondary }]}
              >
                {item.label()}
              </Text>
            </GlassPressable>
          );
        })}
      </View>

      {/* Panel: sabit yükseklik — sekme değişince sayfa zıplamaz. */}
      <View style={[styles.panel, hide]}>
        {tab === "layout" && (
          <View style={styles.layoutRow}>
            {LAYOUTS.map((item) => (
              <LayoutCard
                key={item.id}
                theme={theme}
                item={item}
                active={layoutId === item.id}
                disabled={item.id === "picks" && !hasFavorites}
                onPress={() => onPickLayout(item.id)}
              />
            ))}
          </View>
        )}

        {tab === "color" && (
          <View style={styles.colorPanel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.swatchRow}>
              {THEME_ITEMS.map((item) => (
                <Swatch
                  key={item.id}
                  theme={theme}
                  item={item}
                  accent={accent}
                  ringColors={profileInfo.ringColors}
                  active={options.themeId === item.id}
                  onPress={() => update({ themeId: item.id })}
                />
              ))}
            </ScrollView>
            <Segmented
              theme={theme}
              value={options.background}
              onChange={(background) => update({ background })}
              items={[
                { id: "glow", label: () => i18nText("autoI18n.profil_story_arkaplan_parlak", "Parlak") },
                { id: "clean", label: () => i18nText("autoI18n.profil_story_arkaplan_sade", "Sade") },
              ]}
            />
          </View>
        )}

        {tab === "content" && (
          <View style={styles.contentPanel}>
            {favoritesActive ? (
              <MultiSegmented
                theme={theme}
                selected={favoritePick.kinds}
                items={FAVORITE_KINDS.map((kind) => ({
                  id: kind,
                  label: favoritesCopy.kinds[kind].label,
                  disabled: countFavorites(favorites, kind) === 0,
                }))}
                onToggle={onToggleKind}
              />
            ) : hasAnyPoster ? (
              <Segmented
                theme={theme}
                value={options.posterSource}
                onChange={(posterSource) => update({ posterSource })}
                items={SOURCES}
              />
            ) : (
              <View style={[styles.emptyHint, { borderColor: alpha(theme.border, 0.8) }]}>
                <AppIcon family="Ionicons" name="images-outline" size={15} color={theme.text.muted} />
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.emptyHintText, { color: theme.text.muted }]}>
                  {i18nText("autoI18n.profil_story_poster_yok", "Henüz posteri olan bir listen yok")}
                </Text>
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.chipGrid}>
              {TOGGLE_ROWS.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.chipRow}>
                  {row.map((item) => (
                    <ToggleChip
                      key={item.key}
                      theme={theme}
                      item={item}
                      on={options[item.key]}
                      disabled={blockedReason(item) !== null}
                      onPress={() => onToggle(item)}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Eylemler */}
      <View style={[styles.actions, hide]}>
        <GlassPressable
          onPress={() => run("save")}
          disabled={!!busy || !ready}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.profil_story_kaydet", "Galeriye kaydet")}
          style={[
            styles.saveBtn,
            { backgroundColor: theme.secondary, borderColor: alpha(theme.border, 0.9), opacity: busy || !ready ? 0.55 : 1 },
          ]}
        >
          {busy === "save" ? (
            <ActivityIndicator size="small" color={theme.text.primary} />
          ) : (
            <AppIcon family="Ionicons" name="download-outline" size={22} color={theme.text.primary} />
          )}
        </GlassPressable>

        <GlassPressable
          onPress={() => run("share")}
          disabled={!!busy || !ready}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.profil_story_paylas", "Hikâyede paylaş")}
          style={({ pressed }) => [
            styles.shareBtn,
            { backgroundColor: accent, opacity: busy || !ready ? 0.7 : pressed ? 0.9 : 1 },
          ]}
        >
          {busy === "share" || !ready ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <AppIcon family="Ionicons" name="logo-instagram" size={20} color="#FFFFFF" />
              <Text allowFontScaling={false} numberOfLines={1} style={styles.shareText}>
                {i18nText("autoI18n.profil_story_paylas", "Hikâyede paylaş")}
              </Text>
            </>
          )}
        </GlassPressable>
      </View>
    </View>
  );
}

export default function ProfileStoryModal({ visible, onClose, ...identity }) {
  const { theme } = useTheme();
  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={38}
      sheetStyle={[
        styles.sheet,
        { backgroundColor: theme.primary, borderColor: alpha(theme.border, 0.9) },
      ]}
    >
      {/* Düzenleyici yalnız sayfa açıkken bağlanır: bağlam okumaları ve poster
          hesabı profil ekranının her çiziminde çalışmasın. */}
      <ProfileStoryEditor onClose={onClose} {...identity} />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "94%",
    paddingTop: 10,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 16,
  },
  body: {},
  hidden: { display: "none" },
  noGrow: { flexGrow: 0 },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, marginBottom: 10, opacity: 0.6 },

  header: { flexDirection: "row", alignItems: "center", gap: 10, height: 44 },
  headerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  subtitle: { fontSize: 12, fontWeight: "500", marginTop: 1 },

  previewArea: { alignItems: "center", justifyContent: "center", marginTop: 10, marginBottom: 8 },
  previewFrame: {
    overflow: "hidden",
    borderWidth: 1,
    backgroundColor: "#0A0710",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  feedback: {
    position: "absolute",
    bottom: 10,
    maxWidth: "92%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  feedbackText: { flexShrink: 1, color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  noteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    height: 44,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  noteInput: { flex: 1, fontSize: 13.5, fontWeight: "500", paddingVertical: 0 },

  tabs: { flexDirection: "row", gap: 6, height: 40, marginBottom: 8 },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabText: { fontSize: 12.5, fontWeight: "800" },

  panel: { height: PANEL_H, justifyContent: "center" },

  layoutRow: { flexDirection: "row", gap: 6 },
  layoutCard: {
    flex: 1,
    height: PANEL_H,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  layoutLabel: { fontSize: 11.5, fontWeight: "800" },
  thumb: { width: 52, height: 78, borderRadius: 8, borderWidth: 1, overflow: "hidden" },

  colorPanel: { gap: 10 },
  swatchRow: { gap: 12, paddingHorizontal: 2, alignItems: "flex-start" },
  swatchWrap: { alignItems: "center", gap: 4, width: 56 },
  swatchRing: { padding: 2, borderRadius: 15, borderWidth: 2 },
  swatch: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  swatchDot: { position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: 4 },
  swatchLabel: { fontSize: 10.5, fontWeight: "700" },

  contentPanel: { gap: 10 },
  // Yatay ScrollView'un içerik kabı varsayılan olarak `row`dur; iki satırın alt
  // alta durması için `column` AÇIKÇA verilmeli.
  chipGrid: { flexDirection: "column", gap: 8, paddingRight: 4 },
  chipRow: { flexDirection: "row", gap: 8 },
  toggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  toggleText: { fontSize: 12.5, fontWeight: "700" },
  emptyHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyHintText: { fontSize: 12, fontWeight: "600" },

  segmented: { flexDirection: "row", height: 36, padding: 3, borderRadius: 13, borderWidth: 1, gap: 3 },
  segmentedItem: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  segmentedText: { fontSize: 12.5, fontWeight: "800" },

  actions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  saveBtn: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  shareBtn: { flex: 1, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 16 },
  shareText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", letterSpacing: -0.1 },
});
