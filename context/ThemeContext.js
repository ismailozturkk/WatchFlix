import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Easing, Image, StyleSheet } from "react-native";
import { captureScreen, releaseCapture } from "react-native-view-shot";
import { buildCustomTheme, getThemeColors } from "../theme/colors";
import { useThemeSettings } from "./AppSettingsContext";

const ThemeContext = createContext();

// Eski ekran görüntüsünün yeni renklerin üzerinden solma süresi.
const THEME_FADE_MS = 450;

// "custom:<id>" veya eski "custom" seçimine karşılık gelen özel temayı bulur.
const findCustomTheme = (selectedTheme, customThemes) => {
  if (!selectedTheme || !selectedTheme.startsWith("custom")) return null;
  const id = selectedTheme.includes(":") ? selectedTheme.split(":")[1] : null;
  if (id) return customThemes.find((t) => t.id === id) || null;
  return customThemes[0] || null; // legacy "custom" -> ilk özel tema
};

export const ThemeProvider = ({ children }) => {
  const {
    selectedTheme,
    changeTheme: applyTheme,
    customThemes = [],
    saveCustomTheme,
    deleteCustomTheme,
  } = useThemeSettings();

  // Animasyonlu tema geçişi: renkler stillere düz değer olarak dağıldığından
  // (yüzlerce bileşen) renkleri tek tek anime etmek mümkün değil. Onun yerine
  // değişimden hemen önce ekranın anlık görüntüsü en üste konur, tema altında
  // değişir ve görüntü solarak yeni renkleri açığa çıkarır (cross-fade).
  const [snapshotUri, setSnapshotUri] = useState(null);
  const fade = useRef(new Animated.Value(1)).current;
  const transitionRef = useRef(null); // { apply, applied, uri, timer, done }

  const finishTransition = useCallback((tr) => {
    transitionRef.current = null;
    setSnapshotUri(null);
    if (tr.uri) releaseCapture(tr.uri);
    tr.done();
  }, []);

  // Anlık görüntü ekrana geldiğinde tema uygulanır; ağaç yeni renklerle
  // çizilene kadar iki kare beklenip solma başlatılır.
  const revealNewTheme = useCallback(() => {
    const tr = transitionRef.current;
    if (!tr || tr.applied) return;
    tr.applied = true;
    if (tr.timer) clearTimeout(tr.timer);
    tr.apply();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        Animated.timing(fade, {
          toValue: 0,
          duration: THEME_FADE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(() => finishTransition(tr));
      }),
    );
  }, [fade, finishTransition]);

  // Görüntü zamanında ekrana gelmedi (onLoadEnd düşmedi): animasyondan
  // vazgeçip anında değiştir. Görüntü ekranda bırakılırsa geç decode olan
  // eski ekran, solma ortasında yarı saydam belirip flash yapabiliyor.
  const skipTransition = useCallback(() => {
    const tr = transitionRef.current;
    if (!tr || tr.applied) return;
    tr.applied = true;
    tr.apply();
    finishTransition(tr);
  }, [finishTransition]);

  const changeTheme = useCallback(
    (newTheme, { animated = true, onApply } = {}) => {
      // onApply: temayla AYNI commit'te çalışması gereken yan state yazımı
      // (ör. aktif özel temanın token'ları). Erken yazılırsa ekran görüntü
      // alınmadan yeni renklere boyanır ve solma görünmez olur.
      const apply = () => {
        if (onApply) onApply();
        applyTheme(newTheme);
      };
      // animated:false — RN Modal içinden yapılan seçimler için (modal ayrı
      // native pencerede çizilir; overlay onu örtemez, iOS'ta görüntüde
      // modalın "hayaleti" kalır). Doğrudan, animasyonsuz uygulanır.
      if (!animated) {
        apply();
        return Promise.resolve();
      }
      const active = transitionRef.current;
      if (active) {
        // Geçiş sürerken gelen yeni seçim: son seçim kazanır. Tema zaten
        // uygulandıysa anında değiştir (süren solma yeni renkleri açığa
        // çıkarmaya devam eder), değilse bekleyen uygulamayı değiştir.
        if (active.applied) apply();
        else active.apply = apply;
        return Promise.resolve();
      }
      // Dönen promise, tema uygulanıp solma bittiğinde (veya animasyonsuz
      // düşüşte hemen) çözülür — çağıran taraf navigasyon/toast'ı geciktirebilir.
      return new Promise((done) => {
        const tr = {
          apply,
          applied: false,
          uri: null,
          timer: null,
          done,
        };
        transitionRef.current = tr;
        captureScreen({ format: "jpg", quality: 0.9 })
          .then((uri) => {
            tr.uri = uri;
            fade.setValue(1);
            setSnapshotUri(uri);
            tr.timer = setTimeout(skipTransition, 350);
          })
          .catch(() => {
            // Görüntü alınamadı -> animasyonsuz, anında değiştir. tr.apply
            // çağrılır (closure'daki newTheme değil): geçiş beklerken seçim
            // değiştiyse son seçim uygulanmalı.
            transitionRef.current = null;
            tr.apply();
            done();
          });
      });
    },
    [applyTheme, fade, skipTransition],
  );

  // Son üretilen tema: seçili özel tema silindiğinde (geçişin apply adımı
  // gelene kadar selectedTheme hâlâ "custom:<id>" kalır) gri fallback'e
  // düşüp tüm uygulamanın bir anlığına gri "flash" yapmasını önler.
  const lastThemeRef = useRef(null);

  const value = useMemo(() => {
    // Bir özel tema seçiliyse token setinden tam tema üretilir; bulunamazsa
    // önce son bilinen temaya, o da yoksa yerleşik temaya geri düşülür.
    const custom = findCustomTheme(selectedTheme, customThemes);
    const theme = custom
      ? buildCustomTheme(custom.tokens)
      : typeof selectedTheme === "string" &&
          selectedTheme.startsWith("custom") &&
          lastThemeRef.current
        ? lastThemeRef.current
        : getThemeColors(selectedTheme);
    lastThemeRef.current = theme;
    return {
      theme,
      selectedTheme,
      changeTheme,
      customThemes,
      saveCustomTheme,
      deleteCustomTheme,
    };
  }, [selectedTheme, changeTheme, customThemes, saveCustomTheme, deleteCustomTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {snapshotUri ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.snapshotOverlay, { opacity: fade }]}
        >
          <Image
            source={{ uri: snapshotUri }}
            style={StyleSheet.absoluteFill}
            fadeDuration={0}
            onLoadEnd={revealNewTheme}
          />
        </Animated.View>
      ) : null}
    </ThemeContext.Provider>
  );
};

const styles = StyleSheet.create({
  // Splash katmanı 9999'da; tema geçişi onun hemen altında kalmalı.
  snapshotOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
  },
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
