// components/profile/ProfileAvatarHalo.js
//
// Profil başlığındaki avatar + ilerleme halkası + halkanın rengini taşıyan
// parlama ve dokunma animasyonu. ProfileScreen'in o bloğu buraya taşındı.
//
// KATMAN SIRASI (arkadan öne): parlama → dalga → ilerleme halkası → yıldız
// kuyruğu → avatar.
//
// TASARIM KARARLARI
//
//   • Parlama = radyal degrade (SVG), blur filtresi YOK (bkz. AmbientBackground
//     ve blur-android-target). İki degrade, halkanın kendi iki rengini taklit
//     eder: halkada sağ taraf `ringColor`, sol taraf `ringColor2` (kütüphane
//     degradeyi dikey çizip 270° döndürüyor). Degrade id'leri örnek başına
//     benzersiz: react-native-svg'de Defs ad alanı Android'de global.
//   • Her hareket transform/opacity ve native sürücüde; kare başına JS işi yok.
//     SVG özellikleri native animasyonlanamadığı için parlamanın "nabzı" SVG'yi
//     saran Animated.View'in opacity/scale'i ile yapılır.
//   • Dokunma: basınca avatar içeri çöker ve parlama yanar; bırakınca yaylanıp
//     fazla büyür, halkanın üstünden bir yıldız kuyruğu tam tur atar, dışarı
//     halka dalgası yayılır. Uzun basma bu akışa GİRMEZ (önizleme kendi açılış
//     animasyonuna sahip).
//   • Seçim sayfası `OPEN_DELAY_MS` sonra açılır: hemen açılırsa bulanık arka
//     plan animasyonu ilk karede örter. Bu süre içinde ikinci dokunuş yok sayılır.
//   • İlerleme halkası seçim sayfası açıkken söküldü (kapanınca yeniden dolması
//     eskiden beri böyle); animasyon sürerken halka SÖKÜLMEZ, yoksa kuyruk boş
//     bir yörüngede dönerdi.
//   • "Hareketi Azalt" açıkken hiçbir hareket yok: sayfa hemen açılır, parlama
//     statik kalır.

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { CircularProgressBase } from "react-native-circular-progress-indicator";
import UserAvatar from "../common/UserAvatar";
import { AvatarSkeleton } from "../Skeleton";
import useReduceMotion from "../../hooks/useReduceMotion";
import * as Haptics from "../../services/hapticsService";
import {
  HALO_AVATAR_SIZE,
  HALO_RING_RADIUS,
  HALO_RING_STROKE,
  cometTail,
  glowStops,
  haloGeometry,
} from "../../utils/avatarHalo";

const FALLBACK_COLOR = "#C25AFF";
const OPEN_DELAY_MS = 190;
const SPIN_MS = 700;
const FLARE_UP_MS = 160;
const FLARE_DOWN_MS = 720;
const RIPPLE_MS = 680;
const PRESSED_SCALE = 0.94;
const POP_SCALE = 1.08;

const GEO = haloGeometry();
const TAIL = cometTail(6, 7, GEO.strokePx + 1.5);
const STOPS = glowStops(GEO);

const RING_PROPS = {
  activeStrokeWidth: HALO_RING_STROKE,
  inActiveStrokeWidth: HALO_RING_STROKE,
  inActiveStrokeOpacity: 0.05,
};

// Halka parlaması: iki renkli radyal degrade, İKİSİ DE halkayla eş merkezli.
// (İlk sürümde merkezler yatayda kaydırılmıştı: ışıma halkaya göre yamuk
// duruyor, kaydırılan degradenin sınırı da dairenin kenarında kesiliyordu.)
// İkinci ton daha açık ve daha hafif bir katman olarak üstüne biner.
function GlowLayer({ ringColor, ringColor2, ids }) {
  const c = GEO.glowSize / 2;
  const gradients = [
    { id: ids.b, color: ringColor2, weight: 0.6 },
    { id: ids.a, color: ringColor, weight: 1 },
  ];
  return (
    <Svg width={GEO.glowSize} height={GEO.glowSize}>
      <Defs>
        {gradients.map((g) => (
          <RadialGradient
            key={g.id}
            id={g.id}
            gradientUnits="userSpaceOnUse"
            cx={c}
            cy={c}
            r={c}
          >
            {STOPS.map((s) => (
              <Stop
                key={s.offset}
                offset={s.offset}
                stopColor={g.color}
                stopOpacity={s.opacity * g.weight}
              />
            ))}
          </RadialGradient>
        ))}
      </Defs>
      {gradients.map((g) => (
        <Circle key={g.id} cx={c} cy={c} r={c} fill={`url(#${g.id})`} />
      ))}
    </Svg>
  );
}

const ProfileAvatarHalo = ({
  source,
  isCustomPhoto,
  loading,
  progress,
  ringColor,
  ringColor2,
  ringHidden,
  backgroundColor,
  onPress,
  onLongPress,
}) => {
  const reduceMotion = useReduceMotion();
  const rid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = useMemo(() => ({ a: `${rid}ga`, b: `${rid}gb` }), [rid]);
  const color = ringColor || FALLBACK_COLOR;
  const color2 = ringColor2 || FALLBACK_COLOR;

  const avatarScale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;

  const [flourishing, setFlourishing] = useState(false);
  // Animasyon sürerken basma/bırakma geri bildirimi araya girmesin. React
  // Native'in Pressability'si hızlı dokunuşta onPressOut'u onPress'TEN SONRA
  // (en az 130 ms basma süresi için bekleyerek) çağırır; korumasız, bu çağrı
  // dokunma animasyonunu yarıda kesip halkayı söker (bkz. başlık notu).
  const flourishRef = useRef(false);
  const openTimer = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (openTimer.current) clearTimeout(openTimer.current);
    };
  }, []);

  const handlePressIn = useCallback(() => {
    if (reduceMotion || flourishRef.current) return;
    Animated.parallel([
      Animated.spring(avatarScale, {
        toValue: PRESSED_SCALE,
        speed: 40,
        bounciness: 0,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 0.45,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [avatarScale, glow, reduceMotion]);

  // Bırakma / iptal / uzun basma sonrası: normale yaylan. Yavaş dokunuşta
  // (onPressOut onPress'ten ÖNCE gelir) dokunma akışı bu animasyonların üstüne
  // geçer; hızlı dokunuşta (onPressOut SONRA gelir) flourishRef araya girmeyi
  // engeller.
  const handlePressOut = useCallback(() => {
    if (reduceMotion || flourishRef.current) return;
    Animated.parallel([
      Animated.spring(avatarScale, {
        toValue: 1,
        speed: 24,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [avatarScale, glow, reduceMotion]);

  const handlePress = useCallback(() => {
    if (openTimer.current || flourishRef.current) return;
    if (reduceMotion) {
      onPress?.();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flourishRef.current = true;
    setFlourishing(true);
    spin.setValue(0);
    ripple.setValue(0);

    Animated.parallel([
      // Avatar: çöküşten fazla büyüyüp yaylanarak yerine oturur.
      Animated.sequence([
        Animated.timing(avatarScale, {
          toValue: POP_SCALE,
          duration: 120,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(avatarScale, {
          toValue: 1,
          friction: 4,
          tension: 150,
          useNativeDriver: true,
        }),
      ]),
      // Parlama: yanıp yavaşça söner.
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: FLARE_UP_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: FLARE_DOWN_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      // Yıldız kuyruğu: halkanın üstünde tam tur, sonda yavaşlar.
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.bezier(0.15, 0.8, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(ripple, {
        toValue: 1,
        duration: RIPPLE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      flourishRef.current = false;
      if (alive.current) setFlourishing(false);
    });

    openTimer.current = setTimeout(() => {
      openTimer.current = null;
      onPress?.();
    }, OPEN_DELAY_MS);
  }, [avatarScale, glow, onPress, reduceMotion, ripple, spin]);

  const glowStyle = {
    // Boşta ince bir hale (0.42 × zirve ≈ 0.13); dokunuşta tam yoğunluğa çıkar.
    opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.42, 1] }),
    transform: [
      {
        scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }),
      },
    ],
  };
  const rippleStyle = {
    borderColor: color,
    opacity: ripple.interpolate({
      inputRange: [0, 0.15, 1],
      outputRange: [0, 0.7, 0],
    }),
    transform: [
      {
        scale: ripple.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.28],
        }),
      },
    ],
  };
  const tailOpacity = spin.interpolate({
    inputRange: [0, 0.03, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });

  const showRing = !ringHidden || flourishing;

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={onLongPress}
      delayLongPress={220}
      accessibilityRole="button"
      style={styles.touch}
    >
      {loading ? (
        <AvatarSkeleton />
      ) : (
        <View style={styles.stage}>
          <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]}>
            <GlowLayer ringColor={color} ringColor2={color2} ids={ids} />
          </Animated.View>

          <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle]} />

          <View style={styles.ring} pointerEvents="none">
            {showRing && (
              <CircularProgressBase
                {...RING_PROPS}
                value={progress}
                maxValue={100}
                radius={HALO_RING_RADIUS}
                inActiveStrokeColor={color2}
                activeStrokeColor={color}
                activeStrokeSecondaryColor={color2}
                duration={500}
                showProgressValue={false}
              />
            )}
          </View>

          {flourishing &&
            TAIL.map((dot) => (
              <Animated.View
                key={dot.lagDeg}
                pointerEvents="none"
                style={[
                  styles.orbit,
                  {
                    opacity: tailOpacity,
                    transform: [
                      {
                        rotate: spin.interpolate({
                          inputRange: [0, 1],
                          outputRange: [`${-dot.lagDeg}deg`, `${360 - dot.lagDeg}deg`],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      width: dot.size,
                      height: dot.size,
                      borderRadius: dot.size / 2,
                      top: GEO.ringSize / 2 - GEO.orbitRadius - dot.size / 2,
                      left: GEO.ringSize / 2 - dot.size / 2,
                      opacity: dot.opacity,
                      shadowColor: color,
                    },
                  ]}
                />
              </Animated.View>
            ))}

          <Animated.View
            style={[
              styles.avatarShadow,
              { backgroundColor, transform: [{ scale: avatarScale }] },
            ]}
          >
            <UserAvatar
              source={source}
              fallbackSource={require("../../assets/avatar/3.png")}
              isCustomPhoto={isCustomPhoto}
              size={HALO_AVATAR_SIZE}
              style={{ backgroundColor }}
              priority="high"
              cachePolicy="memory-disk"
            />
          </Animated.View>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // Halka radius=78 → 156x156 (bkz. utils/avatarHalo.js); AvatarSkeleton ile
  // aynı boyut, yükleme sırasında sıçrama olmasın.
  touch: {
    width: GEO.ringSize,
    height: GEO.ringSize,
    borderRadius: GEO.ringSize / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  stage: {
    width: GEO.ringSize,
    height: GEO.ringSize,
    borderRadius: GEO.ringSize / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  glow: {
    position: "absolute",
    top: -GEO.glowReach,
    left: -GEO.glowReach,
    width: GEO.glowSize,
    height: GEO.glowSize,
  },
  ripple: {
    position: "absolute",
    top: 0,
    left: 0,
    width: GEO.ringSize,
    height: GEO.ringSize,
    borderRadius: GEO.ringSize / 2,
    borderWidth: 2.5,
    opacity: 0,
  },
  ring: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  orbit: {
    position: "absolute",
    top: 0,
    left: 0,
    width: GEO.ringSize,
    height: GEO.ringSize,
  },
  dot: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  avatarShadow: {
    width: HALO_AVATAR_SIZE,
    height: HALO_AVATAR_SIZE,
    borderRadius: HALO_AVATAR_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default React.memo(ProfileAvatarHalo);
