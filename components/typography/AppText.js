// components/typography/AppText.js
//
// Uygulamadaki her metnin geçtiği ince kabuk. Karar mantığı burada DEĞİL,
// saf ve test edilebilir utils/typographyRoles.js içinde durur; burada yalnız
// React/RN'e özgü işler var: stili düzleştirmek, mirası taşımak, sonucu
// önbelleğe almak.
//
// Bu dosya doğrudan import edilmez — scripts/babel-transform-app-text.js
// uygulama kaynaklarındaki react-native `Text`/`TextInput` (ve JSX'teki
// `Animated.Text`) kullanımlarını derleme sırasında buraya yönlendirir.
// Yani yeni bir ekran yazarken ekstra bir şey yapmak gerekmez.
//
// ROL: her metin BAŞLIK / NORMAL YAZI / RAKAM rollerinden birine düşer ve her
// rolün fontunu kullanıcı ayrı ayrı seçer. Otomatik kural yanılırsa çağıran
// taraf `fontRole="body"` gibi bir prop ile kararı ezer. (`role` adı KULLANILAMAZ:
// React Native'de o prop erişilebilirlik/ARIA rolüdür.)
import React, { createContext, forwardRef, useContext, useMemo } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
} from "react-native";
import Reanimated from "react-native-reanimated";
import {
  hasItalicVariant,
  needsSystemFamilyReset,
  resolveFontFamily,
  resolveTextRole,
} from "../../utils/typographyRoles";
import { useTypographyState } from "../../services/typographySettings";

/**
 * İç içe <Text>'lerde miras. React Native'de iç Text, dış Text'in
 * fontSize/fontWeight'ini miras alır ama biz yalnızca kendi style prop'umuzu
 * görürüz; bu context o boşluğu kapatır. Aksi halde `Watch<Text>ify</Text>`
 * gibi bir başlıkta iç parça 14px/400 sanılır ve kelimenin ortasında font
 * değişir (kanıt: screens/auth/LoginScreen.js:246).
 */
const InheritedTextStyle = createContext(null);

// Çözülmüş stil nesneleri paylaşılır: aynı (rol, ağırlık, italik) üçlüsü tüm
// ekranda tek bir nesneye işaret eder. Hem yeniden hesaplamayı hem de
// gereksiz stil kimliği değişimini önler. Boyut sınırlı: preset × 5 ağırlık × 2 × 2.
const onbellek = new Map();

/** Sistem fontunda kalınıp yalnız rakam hizalaması istendiğinde. */
const SADECE_TABULAR = Object.freeze({ fontVariant: ["tabular-nums"] });

/** Mirası kırıp platformun kendi yazı tipine dönmek için gereken açık ad. */
const SISTEM_AILESI = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: undefined,
});

/**
 * Dış Text özel bir aile uygularken, rolü "Sistem"e düşen İÇ Text'in mirası
 * kırması için gereken stil. Aile kadar AĞIRLIK da geri alınmalı: özel aile
 * uygulayan dış Text `fontWeight: "400"` bastığı için (sentetik kalınlık
 * engellensin diye) iç parça onu da miras alır.
 */
const sifirlamaStili = (fontWeight, italic, tabular) => {
  const anahtar = `sifirla|${String(fontWeight)}|${italic ? 1 : 0}|${tabular ? 1 : 0}`;
  const hazir = onbellek.get(anahtar);
  if (hazir !== undefined) return hazir;

  const stil = {
    fontFamily: SISTEM_AILESI,
    fontWeight: fontWeight === undefined || fontWeight === null ? "normal" : fontWeight,
    fontStyle: italic ? "italic" : "normal",
  };
  if (tabular) stil.fontVariant = ["tabular-nums"];
  onbellek.set(anahtar, stil);
  return stil;
};

const stilUret = (presetId, fontWeight, italic, tabular) => {
  const anahtar = `${presetId}|${fontWeight}|${italic ? 1 : 0}|${tabular ? 1 : 0}`;
  const hazir = onbellek.get(anahtar);
  if (hazir !== undefined) return hazir;

  // Ailenin gerçek bir italik varyantı yoksa eğme işini RN'e bırak.
  const gercekItalik = italic && hasItalicVariant(presetId);
  const fontFamily = resolveFontFamily({
    presetId,
    fontWeight,
    italic: gercekItalik,
  });
  let stil = null;
  if (fontFamily) {
    stil = {
      fontFamily,
      // Her ağırlık ayrı bir dosya/aile adı olarak yüklendiği için RN'in
      // ayrıca sentetik kalınlık uygulamasını önle.
      fontWeight: "400",
    };
    // Aile italik varyantını kendi adıyla taşıyorsa RN'in eğmesine gerek yok.
    if (gercekItalik) stil.fontStyle = "normal";
    if (tabular) stil.fontVariant = ["tabular-nums"];
  } else if (tabular) {
    stil = SADECE_TABULAR;
  }
  onbellek.set(anahtar, stil);
  return stil;
};

const duzlestir = (style) => {
  try {
    return StyleSheet.flatten(style) || {};
  } catch {
    return {};
  }
};

/** Çocuklar arasında React elementi var mı — miras context'i yalnız o zaman gerekir. */
const elementIceriyor = (children) => {
  if (Array.isArray(children)) return children.some(elementIceriyor);
  return typeof children === "object" && children !== null;
};

function useCozulmusTipografi({ style, children, fontRole, isInput }) {
  const durum = useTypographyState();
  const miras = useContext(InheritedTextStyle);

  return useMemo(() => {
    const flat = duzlestir(style);

    // Kendi stilinde yoksa dış Text'ten miras al; o da yoksa RN varsayılanı.
    const fontSize = flat.fontSize ?? miras?.fontSize;
    const fontWeight = flat.fontWeight ?? miras?.fontWeight;
    const fontStyle = flat.fontStyle ?? miras?.fontStyle;
    const textTransform = flat.textTransform ?? miras?.textTransform;

    const rol = resolveTextRole({
      explicitRole: fontRole,
      isInput,
      fontSize,
      fontWeight,
      textTransform,
      content: children,
    });

    // Hizalanması gereken sayılar dışında tabular-nums'a gerek yok; girdide ise
    // yazarken karakter genişliğini değiştirip imleci titretir.
    const tabular = rol === "numeric" && !flat.fontVariant;
    const italik = fontStyle === "italic";

    let stil = null;
    let uygulananAile = null;

    // Story editörü ve kod/teknik metinler kendi fontFamily'sini bilerek verir;
    // kullanıcının içerik seçimini ezme (bkz. components/modals/ChatModal.js).
    if (flat.fontFamily) {
      stil = tabular ? SADECE_TABULAR : null;
      uygulananAile = flat.fontFamily;
    } else if (!durum.fontsLoaded) {
      // Fontlar yüklenmeden hiçbir metin özel aile almaz; miras da boştur.
      stil = tabular ? SADECE_TABULAR : null;
    } else {
      stil = stilUret(durum[rol], fontWeight, italik, tabular);
      uygulananAile = stil?.fontFamily || null;
      // Rolü "Sistem"e düşen İÇ metin, dış metnin özel ailesini native olarak
      // miras alır. Aileyi açıkça yazmazsak kullanıcının o rol için yaptığı
      // "Sistem" seçimi sessizce yok sayılır.
      if (needsSystemFamilyReset(uygulananAile, miras?.fontFamily)) {
        stil = sifirlamaStili(fontWeight, italik, tabular);
        uygulananAile = SISTEM_AILESI || null;
      }
    }

    // Alt ağaca taşınacak "gerçek" tipografi. Referansın gereksiz değişmemesi
    // için mirasla birebir aynıysa aynı nesne döner.
    const devirAilesi = uygulananAile ?? miras?.fontFamily ?? null;
    const devir =
      miras &&
      miras.fontSize === fontSize &&
      miras.fontWeight === fontWeight &&
      miras.fontStyle === fontStyle &&
      miras.textTransform === textTransform &&
      miras.fontFamily === devirAilesi
        ? miras
        : {
            fontSize,
            fontWeight,
            fontStyle,
            textTransform,
            fontFamily: devirAilesi,
          };

    return { stil, devir };
  }, [children, durum, fontRole, isInput, miras, style]);
}

export const AppText = forwardRef(function AppText(
  { children, style, fontRole, ...props },
  ref,
) {
  const { stil, devir } = useCozulmusTipografi({ style, children, fontRole });
  const node = (
    <NativeText ref={ref} style={stil ? [style, stil] : style} {...props}>
      {children}
    </NativeText>
  );
  // Sağlayıcı yalnız gerçekten iç içe metin varken eklenir: 2200 metnin her
  // birine gereksiz bir provider koymamak için.
  if (!elementIceriyor(children)) return node;
  return (
    <InheritedTextStyle.Provider value={devir}>
      {node}
    </InheritedTextStyle.Provider>
  );
});

export const AppTextInput = forwardRef(function AppTextInput(
  { style, fontRole, ...props },
  ref,
) {
  // Girdinin rolü İÇERİĞE bakılarak seçilmez: kullanıcı "2024" yazınca fontun
  // rakam ailesine atlayıp harf yazınca geri dönmesi (her tuşta) hatalıydı.
  const { stil } = useCozulmusTipografi({ style, fontRole, isInput: true });
  return (
    <NativeTextInput
      ref={ref}
      style={stil ? [style, stil] : style}
      {...props}
    />
  );
});

export const AnimatedAppText = Animated.createAnimatedComponent(AppText);
export const ReanimatedAppText = Reanimated.createAnimatedComponent(AppText);

/**
 * Kendi metnini node_modules içinde çizen kütüphaneler (takvim, markdown,
 * dropdown) bileşen kabul etmez; onlara DÜZ bir fontFamily dizesi vermek
 * gerekir. Bu hook o dizeyi aynı çözücüden üretir — elle yazılan bir aile adı
 * uygulamanın geri kalanından kopardığı için asla elle yazılmamalı.
 *
 * @returns {string|undefined} sistem fontunda veya fontlar yüklenmeden undefined
 */
export function useFontFamilyForRole(role, { fontWeight = "400", italic = false } = {}) {
  const cozucu = useFontResolver();
  return useMemo(
    () => cozucu(role, { fontWeight, italic }),
    [cozucu, fontWeight, italic, role],
  );
}

/**
 * Birden fazla rol/ağırlık çözmesi gereken çağıranlar için (ör. markdown stil
 * nesnesi) tek abonelikle çalışan çözücü. `italic: true` istenip ailenin
 * gerçek italik varyantı yoksa undefined döner — o zaman eğme işini RN yapar.
 */
export function useFontResolver() {
  const durum = useTypographyState();
  return useMemo(() => {
    return (role, { fontWeight = "400", italic = false } = {}) => {
      if (!durum.fontsLoaded) return undefined;
      const presetId = durum[role];
      if (italic && !hasItalicVariant(presetId)) return undefined;
      return resolveFontFamily({ presetId, fontWeight, italic }) || undefined;
    };
  }, [durum]);
}
