// components/badges/AppBadge.js
//
// Parametrik rozet. Uygulamadaki HER rozet — kurucu, premium, 50 başarım —
// bu tek bileşenden çıkar; hiçbir rozet görsel dosya olarak var olmaz.
// Rozet "varlığı" bir JS nesnesidir, "görseli" o nesneden türeyen matematiktir.
//
// Neden dosya değil:
//   • assets/avatar 56 dosya = 2.4 MB. 81 rozet + kilitli varyantları aynı
//     mantıkla megabaytlar demek; burada 0 KB.
//   • Uygulamada 5 tema var (theme/colors.js). Sabit PNG tek zemin varsayar,
//     açık temada kenarları kirlenir; burada renk temadan beslenir.
//   • Ionicons zaten @expo/vector-icons (MIT) ile geliyor ve her ekranda
//     kullanılıyor → yeni lisans yüzeyi yok.
//
// SİLUET KURALI: her rozet sivri tepeli, köşeleri yuvarlatılmış DÜZGÜN
// ÇOKGENdir ve köşe yuvarlaklığı kenar uzunluğuyla ölçeklenir, yani hepsi aynı
// dokuyu paylaşır. NADİRLİK siluete değil, siluetin ÜZERİNE eklenen katmanlara
// (rim kalınlığı, sheen, halo, renk) kodlanır — 81 rozetin tek aile görünmesini
// sağlayan şey budur ve bu kural DEĞİŞMEDİ.
//
// Kenar sayısı ikinci bir ekseni kodlar: aile kademesi (kare → beşgen →
// altıgen → yedigen → sekizgen, bkz. theme/badgeTokens.js `kademeSekli`).
// Varsayılan 6'dır, dolayısıyla `sides` geçmeyen her çağıran — oyun başarımları,
// kimlik rozetleri, kademesiz izleme rozetleri — bugünkü görünümünde kalır.
//
// `color` verilirse GÖVDE/GLYPH/KENAR rengini devralır; nadirlik o durumda
// yalnızca KENAR KALINLIĞI ve IŞIMANIN VARLIĞI üzerinden konuşur. Sebep: 7 ve 8
// kenar tek başına ayırt edilemiyor (52px'te 0,78 ve 0,56 piksel fark), yani
// kademe merdiveninin okunması için renge ihtiyacı var. Işımanın RENGİ de
// gövdeden alınır — mor bir hâlenin zümrüt bir gövdeyi çevrelemesi kirli
// görünürdü.

import React, { useId, useMemo } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from "react-native-svg";
import AppIcon from "@components/AppIcon";
import { useTheme } from "@context/ThemeContext";
import { BADGE_GEO, KENAR_GEO, badgeDetail, rarityStyle } from "@theme/badgeTokens";

const { VIEWBOX, INNER, SHEEN, GLYPH } = BADGE_GEO;
const C = VIEWBOX / 2;

// ─── Yuvarlatılmış çokgen yolu ────────────────────────────────────────────────
// Her köşede kenar yönünde r kadar geri çekilip köşeden geçen bir quadratic
// ile bağlanır. Altıgen sabit olsa da helper olarak duruyor: köşe yarıçapını
// veya kenar sayısını değiştirmek tek sayı değişikliği kalıyor.
function roundedPolygon(points, r) {
  const n = points.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const back = towards(cur, prev, r);
    const fwd = towards(cur, next, r);
    d += (i === 0 ? `M${back[0]} ${back[1]}` : `L${back[0]} ${back[1]}`);
    d += `Q${cur[0]} ${cur[1]} ${fwd[0]} ${fwd[1]}`;
  }
  return `${d}Z`;
}
function towards(from, to, dist) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const k = Math.min(dist, len / 2) / len;
  return [round2(from[0] + dx * k), round2(from[1] + dy * k)];
}
const round2 = (n) => Math.round(n * 100) / 100;

// Sivri tepeli düzgün n-gen: -90°'den başlayıp 360/n'lik adımlar.
function polygonPoints(n, radius) {
  const adim = 360 / n;
  return Array.from({ length: n }, (_, i) => {
    const a = ((-90 + i * adim) * Math.PI) / 180;
    return [round2(C + radius * Math.cos(a)), round2(C + radius * Math.sin(a))];
  });
}

// Yollar kenar sayısı başına BİR KEZ hesaplanıp modül seviyesinde saklanır.
// Her render'da yeniden üretmek 30 rozetlik bir listede her scroll karesinde
// 90 çokgen yolu demekti.
const YOL_CACHE = {};
function yollar(n) {
  const kenar = KENAR_GEO[n] ? n : 6;
  if (YOL_CACHE[kenar]) return YOL_CACHE[kenar];
  const { r, corner } = KENAR_GEO[kenar];
  const kayit = {
    body: roundedPolygon(polygonPoints(kenar, r), corner),
    inner: roundedPolygon(polygonPoints(kenar, r * INNER), corner * INNER),
    sheen: roundedPolygon(polygonPoints(kenar, r * SHEEN), corner * SHEEN),
    // Yay yarıçapı gövdeyle AYNI: sabit bir yarıçap, 47'lik karenin köşelerinin
    // yayı delip geçmesine yol açardı.
    arcR: r,
    arcLen: 2 * Math.PI * r,
  };
  YOL_CACHE[kenar] = kayit;
  return kayit;
}

/**
 * @param {string}  glyph     Ionicons adı, "-outline" biçiminde (kilitli/ilerleme hâli için).
 * @param {string}  glyphSolid Açık hâlde kullanılacak dolu ikon. Verilmezse glyph kullanılır.
 *                            (Otomatik "-outline" silme YAPILMAZ: karşılığı olmayan
 *                             isimde AppIcon kırmızı uyarı üçgeni basıyor.)
 * @param {string}  rarity    common | uncommon | rare | epic | legendary
 * @param {boolean} unlocked
 * @param {number}  progress  0..1 — kilitliyken ilerleme yayı çizilir.
 * @param {number}  size      px
 * @param {boolean} ornate    Kimlik rozetleri (kurucu/premium) ve aile son
 *                            kademesi için çift kontur.
 * @param {number}  sides     Gövde kenar sayısı: 4 | 5 | 6 | 7 | 8. Aile
 *                            kademesini kodlar (theme/badgeTokens.js
 *                            `kademeSekli`). VARSAYILAN 6 — geçmeyen her
 *                            çağıran bugünkü görünümde kalır.
 * @param {string}  color     Kademe rengi. Verilirse nadirlik rengini EZER;
 *                            nadirlik yalnız rim kalınlığı + ışıma varlığıyla
 *                            konuşur. Verilmezse davranış eskisi gibi.
 */
export default function AppBadge({
  glyph = "help-outline",
  glyphSolid,
  rarity = "common",
  unlocked = true,
  progress = 0,
  size = 44,
  ornate = false,
  sides = 6,
  color,
  style,
  accessibilityLabel,
}) {
  const { theme } = useTheme();
  const rid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradId = `bdg${rid}`;

  const r = rarityStyle(rarity, theme);
  const lod = badgeDetail(size);
  const yol = yollar(Math.round(Number(sides) || 6));

  // Kademe rengi nadirlik rengini EZER. Nadirlik kaybolmaz, kanal değiştirir:
  // `r.rim` (1.2 → 2.2 px) ve `r.glow`un VARLIĞI hâlâ nadirlikten geliyor.
  const anaRenk = color || r.color;

  const ratio = Math.max(0, Math.min(1, Number(progress) || 0));
  const showArc = !unlocked && lod.arc && ratio > 0;

  // Kilitli: gövde boş, kenar tema border'ı, glyph soluk. Uygulamanın her
  // yerindeki idiom — "kazanan = kenarlık terfisi + opaklık, asla hue takası".
  const bodyFill = unlocked ? `url(#${gradId})` : theme.primary;
  const rimColor = unlocked ? anaRenk : theme.border;
  const rimWidth = unlocked ? r.rim : 1.2;

  // İlerleme %50'yi geçtiyse gerçek glyph'in outline hâlini göster ("yaklaştın"),
  // altındaysa kilit. Açıkken dolu ikon.
  const iconName = unlocked
    ? glyphSolid || glyph
    : ratio >= 0.5
      ? glyph
      : "lock-closed-outline";
  const iconColor = unlocked ? anaRenk : theme.text.muted;

  // Işımanın VARLIĞI nadirlikten (`r.glow`), RENGİ gövdeden gelir: mor bir hâle
  // zümrüt bir gövdeyi çevrelediğinde kirli görünüyordu.
  const shadow = useMemo(
    () =>
      unlocked && r.glow && lod.halo
        ? {
            shadowColor: anaRenk,
            shadowOpacity: 0.55,
            shadowRadius: size * 0.16,
            shadowOffset: { width: 0, height: size * 0.05 },
            elevation: 4,
          }
        : null,
    [unlocked, r.glow, anaRenk, lod.halo, size],
  );

  return (
    <View
      style={[{ width: size, height: size }, shadow, style]}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Defs>
          {/* id ÇAKIŞMASI: react-native-svg'de Defs ad alanı Android'de doküman
              genelinde globaldir. Aynı ekranda iki rozet aynı id'yi paylaşırsa
              yanlış gradyan uygulanır (siyah/şeffaf render). useId() şart. */}
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={anaRenk} stopOpacity="0.34" />
            <Stop offset="1" stopColor={anaRenk} stopOpacity="0.06" />
          </LinearGradient>
        </Defs>

        <Path d={yol.body} fill={bodyFill} stroke={rimColor} strokeWidth={rimWidth} strokeLinejoin="round" />

        {/* İçeriden ikinci bir saç teli kontur. İki yerde kullanılır: kimlik
            rozetleri (altın tek başına taşıyıcı olmasın, açık temalarda
            zayıflıyor) ve bir AİLENİN SON kademesi — "bu merdivenin sonuna
            geldin" bilgisi başka hiçbir kanalda yok. */}
        {unlocked && ornate && (
          <Path d={yol.inner} fill="none" stroke={anaRenk} strokeWidth={0.9} strokeOpacity={0.75} strokeLinejoin="round" />
        )}

        {unlocked && lod.sheen && (
          <Path d={yol.sheen} fill="none" stroke={anaRenk} strokeWidth={0.8} strokeOpacity={0.35} strokeLinejoin="round" />
        )}

        {showArc && (
          <>
            <Circle cx={C} cy={C} r={yol.arcR} fill="none" stroke={theme.border} strokeWidth={3} />
            <Circle
              cx={C}
              cy={C}
              r={yol.arcR}
              fill="none"
              stroke={theme.accent}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${yol.arcLen}`}
              strokeDashoffset={yol.arcLen * (1 - ratio)}
              transform={`rotate(-90 ${C} ${C})`}
            />
          </>
        )}
      </Svg>

      <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <AppIcon family="Ionicons" name={iconName} size={Math.round(size * GLYPH)} color={iconColor} />
      </View>
    </View>
  );
}
