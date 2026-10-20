// components/common/BlurTarget.js
//
// Android'de blur'ün ARKA PLANINI sağlayan katman.
//
// ── NEDEN GEREKLİ ────────────────────────────────────────────────────────────
//
// expo-blur 55'ten beri Android'de `BlurView` tek başına hiçbir şey
// bulanıklaştırmıyor: neyi bulanıklaştıracağını bir `BlurTargetView` ile açıkça
// göstermek gerekiyor. Hedef verilmezse expo-blur sessizce düz yarı saydam bir
// dikdörtgene düşer (bkz. utils/blurSupport.js'teki tarihçe).
//
// ── İKİ KAPSAM VAR, ÇÜNKÜ "ARKADAKİ" HER YERDE AYNI ŞEY DEĞİL ───────────────
//
//   "root"   → tüm uygulama (sekme çubuğu dahil). MODAL arka planları bunu
//              kullanır: modal her şeyin üstünde açılır.
//   "screen" → yalnız ekran içeriği. SEKME ÇUBUĞU bunu kullanır: çubuk kendisi
//              "root"un içinde olduğu için onu hedefleyemez (aşağıdaki kural).
//
// İç içe sağlayıcı yerine İSİMLİ kapsam kullanılmasının sebebi bu: iç sağlayıcı
// dıştakini gölgeleseydi, sekme ekranlarındaki modallar da "screen"i hedefler ve
// arka planlarında sekme çubuğu eksik kalırdı.
//
// ── EN ÖNEMLİ KURAL: BLUR, HEDEFLEDİĞİ YÜZEYİN İÇİNDE OLAMAZ ────────────────
//
// `BlurTargetSurface` kendi alt ağacını her karede bir RenderNode'a kaydeder;
// `AdaptiveBlurView` de o kaydı okuyup bulanıklaştırır. Blur bileşeni
// hedeflediği yüzeyin İÇİNDE olursa kendi kaydını okumaya çalışır:
// kütüphanenin (Dimezis BlurView 3.1.0) eski yazılım yolunda bunu engelleyen
// bir koruma var (`canvas instanceof BlurViewCanvas → çizme`), ama Android
// 12+'ta çalışan RenderNode yolunda YOK. Sonuç çökme değil, yanlış görüntü.
//
// Bu yüzden bağlama otomatik değil, AÇIK: `blurTarget` verilmeyen her
// AdaptiveBlurView düz katmana düşer (bugünkü davranış, gerileme yok).
//
// RN `Modal` Android'de AYRI BİR PENCEREye çizilir; yani modal içeriği React
// ağacında "root"un altında olsa da native olarak onun çocuğu DEĞİLDİR. Modal
// arka planlarının "root"u hedefleyebilmesinin sebebi budur.
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Platform, View } from "react-native";
import { BlurTargetView } from "expo-blur";
import { androidSupportsNativeBlur } from "../../utils/blurSupport";

/** Native hedefi kurmanın bir kazancı var mı (yalnız Android 12+). */
const HEDEF_ANLAMLI =
  Platform.OS === "android" && androidSupportsNativeBlur(Platform.Version);

/** Kapsam adları — yazım hatası sessizce hedefsiz bırakır, sabitle kullanın. */
export const BLUR_SCOPES = Object.freeze({
  root: "root",
  screen: "screen",
});

const BlurTargetContext = createContext(null);

/**
 * Hedef düğümlerini ağaca yayar. Uygulamada TEK bir tane olmalı (App.js).
 *
 * NEDEN state, sadece ref DEĞİL: React ref'leri alttan üste bağlar, yani
 * hedefin ref'i ondan önce mount olan blur bileşenlerinden SONRA dolar. Salt
 * ref paylaşsaydık expo-blur `componentDidMount`'ta `blurTarget.current`'ı boş
 * görür, bir daha da bakmazdı (`componentDidUpdate` yalnız prop değişince
 * karşılaştırma yapıyor). Düğüm state'e yazılınca tüketiciler yeniden çiziliyor,
 * `.current` değişiyor ve expo-blur hedefi görüyor.
 */
export function BlurTargetProvider({ children }) {
  const [nodes, setNodes] = useState({});

  const register = useCallback((name, node) => {
    setNodes((mevcut) => {
      if (mevcut[name] === (node || null)) return mevcut;
      return { ...mevcut, [name]: node || null };
    });
  }, []);

  const value = useMemo(() => ({ nodes, register }), [nodes, register]);
  return <BlurTargetContext.Provider value={value}>{children}</BlurTargetContext.Provider>;
}

/**
 * Bulanıklaştırılacak içeriği sarar ve verilen ad altında yayınlar.
 *
 * Ağaç derinliği her platformda AYNI kalsın diye hedefin anlamsız olduğu
 * yerlerde de bir host view çiziliyor (expo'nun kendi Android dışı
 * `BlurTargetView`'ı da zaten düz bir `View`); aksi hâlde yalnız Android'de
 * ortaya çıkan yerleşim farkları kovalamak zorunda kalırdık.
 */
export function BlurTargetSurface({ name, children, style, ...rest }) {
  const ctx = useContext(BlurTargetContext);
  const register = ctx?.register;

  const attach = useCallback(
    (node) => {
      if (register) register(name, node || null);
    },
    [register, name],
  );

  if (!HEDEF_ANLAMLI || !register) {
    return (
      <View style={style} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <BlurTargetView ref={attach} style={style} {...rest}>
      {children}
    </BlurTargetView>
  );
}

/**
 * Blur bileşenlerinin `blurTarget` prop'una vereceği ref benzeri nesne.
 * Hedef henüz bağlanmadıysa `null` döner — bu durumda AdaptiveBlurView düz
 * katmana düşer, hata vermez.
 *
 * @param {"root"|"screen"} name
 */
export function useBlurTargetRef(name) {
  const node = useContext(BlurTargetContext)?.nodes?.[name] || null;
  // expo-blur `prevProps.blurTarget?.current !== props.blurTarget?.current`
  // karşılaştırması yapıyor; düğüm değişmedikçe aynı nesneyi döndürmek gereksiz
  // yeniden bağlanmayı önler.
  return useMemo(() => (node ? { current: node } : null), [node]);
}
