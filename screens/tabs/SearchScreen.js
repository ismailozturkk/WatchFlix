import React, { useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Animated,
  Keyboard,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLanguage } from "../../context/LanguageContext";
import { useApiSettings } from "../../context/AppSettingsContext";
import { toast } from "../../components/AppToast";
import { looksLikeMediaLink, parseMediaLink } from "../../utils/mediaLinks";
import { resolveMediaLink } from "../../services/mediaLinkResolver";
import { getMediaLinkCopy } from "../../utils/mediaLinkCopy";
import { useTheme } from "../../context/ThemeContext";
import AppIcon from "../../components/AppIcon";
import ScreenDecor from "../../components/ScreenDecor";
import MovieSearch from "../search/MovieSearch";
import TvShowSearch from "../search/TvShowSearch";
import ActorSearch from "../search/ActorSearch";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import BackButton from "../../components/BackButton";
import GlassField from "../../components/common/GlassField";
import GlassIconButton from "../../components/common/GlassIconButton";
import GlassSegmentedControl from "../../components/common/GlassSegmentedControl";
import { getSearchHeaderCopy } from "../../components/search/searchHeaderCopy";
import { alpha } from "../../theme/colors";
import { isLightSurface } from "../../utils/colorUtils";
import { useFocusEffect } from "@react-navigation/native";
import { Keys, get, set } from "../../services/storage";

// Başlık satırındaki her öğe (geri, alan, görünüm) aynı yükseklikte ve cam olmayan
// yolda da yuvarlak: hap alanın iki yanında daire düğmeler, tek hizada okunur.
const BAR_HEIGHT = 44;

// Tür anahtarının bölmeleri (simgeler Film/Dizi ana ekranındaki MediaTypeSwitch ile aynı).
const TYPE_ICONS = { movie: "videocam", tv: "tv", actor: "person" };

const LayoutToggle = React.memo(({ viewMode, onToggle, theme, labels }) => {
  const anim = useRef(new Animated.Value(viewMode === "grid" ? 1 : 0)).current;

  const toggle = useCallback(() => {
    const next = viewMode === "row" ? "grid" : "row";
    Animated.spring(anim, {
      toValue: next === "grid" ? 1 : 0,
      speed: 18,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
    onToggle(next);
  }, [viewMode, onToggle]);

  // Geri düğmesiyle aynı yuvarlak cam düğme; simge yalnız `transform` ile döner
  // (camın içinde opaklık animasyonu yok).
  return (
    <GlassIconButton
      testID="search-layout-toggle"
      size={BAR_HEIGHT}
      fallbackRadius={BAR_HEIGHT / 2}
      onPress={toggle}
      accessibilityLabel={viewMode === "row" ? labels.gridView : labels.listView}
      style={styles.layoutToggleBtn}
    >
      <Animated.View
        style={{
          transform: [
            {
              rotate: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "180deg"],
              }),
            },
          ],
        }}
      >
        <AppIcon
          family="Ionicons"
          name={viewMode === "row" ? "grid-outline" : "list-outline"}
          size={20}
          color={theme.text?.primary ?? "#fff"}
        />
      </Animated.View>
    </GlassIconButton>
  );
});

export default function SearchScreen({ navigation, route }) {
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const linkCopy = getMediaLinkCopy(language);
  const copy = getSearchHeaderCopy(language);
  const linkBusy = useRef(false);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  // Canlı inset'i, ilk pencere metriğini güvenli yedek olarak kullanarak doğrudan
  // köke uygula (inset ilk karede 0 gelirse arama çubuğu durum çubuğunun altına kaçmasın).
  const topInset = Math.max(
    insets.top,
    initialWindowMetrics?.insets?.top || 0,
  );

  // Route'dan gelen initialType varsa al (örn: ana ekrandan "movie" veya "tv" tıklandıysa)
  const initialType = route?.params?.initialType || "movie";

  const [activeTab, setActiveTab] = useState(initialType);
  const [searchQuery, setSearchQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [viewMode, setViewModeState] = useState(() => get(Keys.searchResultsViewMode));
  const inputRef = useRef(null);
  const accent = theme.accent ?? "#3B82F6";
  const muted = theme.text?.muted ?? "#666";

  // ── Bağlantıdan aç (TMDB / IMDb) ───────────────────────────────────────────
  // Alana yapıştırılan ya da panodaki film/dizi bağlantısı doğrudan o yapımın detayını açar (ekle / izledim
  // düğmeleri orada). IMDb kimliği TMDB'ye /find ile çevrilir; bulunamazsa toast. Aynı anda tek çözümleme.
  const openMediaLink = useCallback(
    async (text) => {
      const link = parseMediaLink(text);
      if (!link) return false;
      if (linkBusy.current) return true;
      linkBusy.current = true;
      try {
        const target = await resolveMediaLink(link, { apiKey: API_KEY, language });
        if (!target) {
          toast.info(linkCopy.notFound);
          return true;
        }
        Keyboard.dismiss();
        navigation.navigate(target.type === "movie" ? "MovieDetails" : "TvShowsDetails", { id: target.id });
        return true;
      } finally {
        linkBusy.current = false;
      }
    },
    [API_KEY, language, linkCopy, navigation],
  );
  const handleChangeText = useCallback(
    (text) => {
      // Yapıştırılan bağlantı arama sorgusu OLMAZ; alana yazılmadan açılır.
      if (looksLikeMediaLink(text)) {
        openMediaLink(text);
        return;
      }
      setSearchQuery(text);
    },
    [openMediaLink],
  );
  const pasteLink = useCallback(async () => {
    let text = "";
    try {
      text = await Clipboard.getStringAsync();
    } catch {
      toast.info(linkCopy.clipboardFailed);
      return;
    }
    if (!(await openMediaLink(text))) toast.info(linkCopy.emptyClipboard);
  }, [linkCopy, openMediaLink]);

  const setViewMode = useCallback((nextMode) => {
    if (nextMode !== "row" && nextMode !== "grid") return;
    setViewModeState(nextMode);
    set(Keys.searchResultsViewMode, nextMode);
  }, []);

  // AÇILIŞ: diğer ekranlar gibi normal yığın geçişi (App.js, varsayılan
  // slide_from_right). Eskiden arama düğmesinden genişleyen bir kabuk (JS sürücülü
  // top/left/width/height animasyonu) ve arama çubuğunun kayarak belirmesi vardı;
  // ağır ilk render'la aynı karelere düşüp takılıyordu, kaldırıldı.
  //
  // Klavye geçiş BİTİNCE açılır: geçişle aynı anda açılan klavye kaymayı da takıltır.
  // `transitionEnd` gelmezse (ör. kısayolla doğrudan açılış) zamanlayıcı yedeği odaklar.
  const hasAutoFocusedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (route?.params?.initialType) {
        setActiveTab(route.params.initialType);
      }
      if (!route?.params?.autoFocus || hasAutoFocusedRef.current) return undefined;
      const focusOnce = () => {
        if (hasAutoFocusedRef.current) return;
        hasAutoFocusedRef.current = true;
        inputRef.current?.focus();
      };
      const unsubscribe = navigation.addListener?.("transitionEnd", (event) => {
        if (!event?.data?.closing) focusOnce();
      });
      const fallback = setTimeout(focusOnce, 600);
      return () => {
        clearTimeout(fallback);
        unsubscribe?.();
      };
    }, [navigation, route?.params])
  );

  const typeOptions = ["movie", "tv", "actor"].map((id) => ({
    value: id,
    label: copy.tabs[id],
    icon: TYPE_ICONS[id],
  }));

  return (
    <View style={[styles.root, { backgroundColor: theme.primary }]}>
        <View
          style={[
            styles.container,
            { paddingTop: topInset + (Platform.OS === "android" ? 10 : 0) },
          ]}
        >
          <ScreenDecor scope="search" iconOpacity={0.3} />

      {/* ── Arama Kutusu ──────────────────────────────────────── */}
      {/* Geri · arama alanı · görünüm: üçü de BAR_HEIGHT, tek hizada. */}
      <View style={styles.searchContainer}>
        <BackButton
          absolute={false}
          size={BAR_HEIGHT}
          fallbackRadius={BAR_HEIGHT / 2}
          style={{ alignSelf: "center" }}
        />
        {/* iOS 26+: hap biçimli Liquid Glass arama alanı (odakta vurgu tonlu); diğer
            yerlerde aynı hap biçiminde tema kutusu, odakta vurgu çerçeveli. */}
        <GlassField
          height={BAR_HEIGHT}
          focused={focused}
          accent={accent}
          fallbackStyle={[
            styles.searchBarBox,
            {
              backgroundColor: theme.secondary,
              borderColor: focused ? alpha(accent, 0.6) : theme.border,
            },
          ]}
          style={styles.searchBar}
        >
          <AppIcon
            family="Ionicons"
            name="search"
            size={18}
            color={focused ? accent : muted}
          />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: theme.text?.primary ?? "#fff" }]}
            placeholder={copy.placeholder[activeTab] ?? copy.placeholder.movie}
            placeholderTextColor={muted}
            selectionColor={accent}
            value={searchQuery}
            onChangeText={handleChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={80}
            returnKeyType="search"
            keyboardAppearance={isLightSurface(theme.primary) ? "light" : "dark"}
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {/* Alan içi eylem: boşken "bağlantıdan aç", yazarken "temizle". Camın
              içinde olduğundan düz dokunulabilir (cam içine cam konmaz). */}
          {searchQuery.length === 0 ? (
            <TouchableOpacity
              testID="search-paste-link"
              onPress={pasteLink}
              accessibilityRole="button"
              accessibilityLabel={linkCopy.pasteLabel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.fieldAction, { backgroundColor: alpha(muted, 0.16) }]}
            >
              <AppIcon
                family="Ionicons"
                name="link"
                size={15}
                color={theme.text?.secondary ?? muted}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="search-clear"
              onPress={() => setSearchQuery("")}
              accessibilityRole="button"
              accessibilityLabel={copy.clear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon
                family="Ionicons"
                name="close-circle"
                size={20}
                color={muted}
              />
            </TouchableOpacity>
          )}
        </GlassField>
        <LayoutToggle
          viewMode={viewMode}
          onToggle={setViewMode}
          theme={theme}
          labels={copy}
        />
      </View>

      {/* ── Tür anahtarı: Film · Dizi · Oyuncu (kayan vurgu hapı) ───────────── */}
      <View style={styles.tabsContainer}>
        <GlassSegmentedControl
          options={typeOptions}
          value={activeTab}
          onChange={setActiveTab}
          height={42}
          accessibilityLabel={copy.typeLabel}
          testIDPrefix="search-type"
        />
      </View>

      {/* ── İçerik ──────────────────────────────────────── */}
          <View style={styles.contentContainer}>
        {activeTab === "movie" && (
          <MovieSearch
            navigation={navigation}
            route={route}
            isUnified={true}
            unifiedQuery={searchQuery}
            unifiedViewMode={viewMode}
          />
        )}
        {activeTab === "tv" && (
          <TvShowSearch
            navigation={navigation}
            route={route}
            isUnified={true}
            unifiedQuery={searchQuery}
            unifiedViewMode={viewMode}
          />
        )}
        {activeTab === "actor" && (
          <ActorSearch
            navigation={navigation}
            route={route}
            isUnified={true}
            unifiedQuery={searchQuery}
            unifiedViewMode={viewMode}
          />
        )}
          </View>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 10,
    gap: 8,
  },
  // Yerleşim iki yolda da geçerli; köşe/çerçeve yalnız eski kutuda (cam kendi
  // şeklini çizer). Eski kutu da hap: camla aynı biçim.
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 0,
  },
  searchBarBox: { borderRadius: BAR_HEIGHT / 2, borderWidth: 1 },
  layoutToggleBtn: { flexShrink: 0 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    height: BAR_HEIGHT,
    paddingVertical: 0,
  },
  fieldAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsContainer: {
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
  },
});
