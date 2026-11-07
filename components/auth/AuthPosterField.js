// components/auth/AuthPosterField.js
//
// Giriş / kayıt / şifre ekranlarının arkasında rastgele konum ve boyutta, yavaşça
// süzülen soluk posterler. Dekoratif: dokunuşu engellemez, ekran okuyucudan gizli.
//
//   • Poster listesi TMDB'nin en çok oy alan film/dizileri; modül içinde bir kez
//     çekilip (dil başına) üç ekranda paylaşılır, ağ yoksa alan sessizce boş kalır.
//   • Yerleşim ekran açılışında bir kez rastgele kurulur (utils/authPosterLayout).
//   • Her poster kendi hız/gecikmesiyle iki eksende hafifçe süzülür ve belirir.
//     Hepsi native sürücüde; ekran odakta değilken ya da "Hareketi Azalt" açıkken
//     durur/çizilmez (pil + erişilebilirlik).
//   • Giriş/kayıt formu şeffaf zeminde durur: okunurluk için posterler düşük
//     opaklıkta ve ortada (formun olduğu bölge) zemin renginde yumuşak bir örtü
//     var; kenarlarda posterler daha net görünür.

import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { alpha } from "../../theme/colors";
import { useIsFocused } from "@react-navigation/native";
import axios from "axios";
import { useLanguage } from "../../context/LanguageContext";
import { useApiSettings, useImageQualitySettings } from "../../context/AppSettingsContext";
import useReduceMotion from "../../hooks/useReduceMotion";
import { tmdbLanguageOf } from "../../utils/appLanguages";
import { generatePosterLayout, pickPosters } from "../../utils/authPosterLayout";

const TMDB = "https://api.themoviedb.org/3";
const POSTER_COUNT = 10;

// Dil başına tek istek; üç auth ekranı arasında gezinirken yeniden çekilmez.
const pathCache = new Map(); // language -> string[] | Promise<string[]>

const shuffled = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function loadPosterPaths(apiKey, language) {
  const cached = pathCache.get(language);
  if (cached) return Promise.resolve(cached);
  const tmdbLanguage = tmdbLanguageOf(language);
  const headers = { accept: "application/json", Authorization: apiKey };
  const request = Promise.all([
    axios.get(`${TMDB}/discover/movie`, {
      params: { sort_by: "vote_count.desc", language: tmdbLanguage, page: 1 },
      headers,
    }),
    axios.get(`${TMDB}/discover/tv`, {
      params: { sort_by: "vote_count.desc", language: tmdbLanguage, page: 1 },
      headers,
    }),
  ])
    .then(([movies, shows]) => {
      const paths = [...(movies.data?.results || []), ...(shows.data?.results || [])]
        .map((item) => item.poster_path)
        .filter(Boolean);
      if (paths.length) pathCache.set(language, paths);
      return paths;
    })
    .catch(() => []);
  return request;
}

/** TMDB poster yolları (her açılışta farklı sırada). Veri yoksa boş dizi. */
function useAuthPosterPaths() {
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const [paths, setPaths] = React.useState(() => {
    const cached = pathCache.get(language);
    return Array.isArray(cached) ? shuffled(cached) : [];
  });

  useEffect(() => {
    if (paths.length || !API_KEY) return undefined;
    let alive = true;
    loadPosterPaths(API_KEY, language).then((list) => {
      if (alive && list.length) setPaths(shuffled(list));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_KEY, language]);

  return paths;
}

// Tek poster: belirme (fade) + sonsuz, çift eksenli süzülme.
function FloatingPoster({ uri, spec, paused, reduceMotion, baseOpacity }) {
  const appear = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: reduceMotion ? 0 : 900,
      delay: reduceMotion ? 0 : spec.delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [appear, spec.delay, reduceMotion]);

  useEffect(() => {
    if (paused || reduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: spec.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [paused, reduceMotion, float, spec.duration]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [spec.drift, -spec.drift] });
  const translateX = float.interpolate({
    inputRange: [0, 1],
    outputRange: [-spec.drift * 0.4, spec.drift * 0.4],
  });
  const scale = float.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] });
  const enter = appear.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: spec.x,
        top: spec.y,
        width: spec.w,
        height: spec.h,
        opacity: Animated.multiply(appear, baseOpacity * spec.opacity),
        transform: [
          { translateX },
          { translateY },
          { rotate: `${spec.rotate}deg` },
          { scale: Animated.multiply(scale, enter) },
        ],
      }}
    >
      <ExpoImage
        source={{ uri }}
        style={styles.image}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={300}
      />
    </Animated.View>
  );
}

/**
 * @param {string} props.surface   ekran zemin rengi (theme.primary) — okunurluk örtüsü
 * @param {boolean} props.isLightTheme
 */
export default function AuthPosterField({ surface, isLightTheme }) {
  const { getTmdbUrl } = useImageQualitySettings();
  const reduceMotion = useReduceMotion();
  const focused = useIsFocused();
  const paths = useAuthPosterPaths();
  const { width, height } = Dimensions.get("window");

  // Yerleşim ekran ömrü boyunca sabit; poster listesi sonradan gelse de konumlar oynamaz.
  const specs = useMemo(
    () => generatePosterLayout({ width, height, count: POSTER_COUNT }),
    [width, height],
  );

  const uris = useMemo(
    () =>
      pickPosters(paths, specs.length)
        .map((path) => getTmdbUrl(path, "poster", 200))
        .filter(Boolean),
    [paths, specs.length, getTmdbUrl],
  );

  if (!uris.length) return null;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {uris.map((uri, i) => (
        <FloatingPoster
          key={`${i}-${uri}`}
          uri={uri}
          spec={specs[i]}
          paused={!focused}
          reduceMotion={reduceMotion}
          baseOpacity={isLightTheme ? 0.3 : 0.36}
        />
      ))}
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(surface, 0), alpha(surface, 0.62), alpha(surface, 0.62), alpha(surface, 0)]}
        locations={[0, 0.3, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { flex: 1, borderRadius: 12 },
});
