// components/cineswipe/useCineCopy.js
//
// CineSwipe metinleri (translations/*.json → cineSwipe). Dil paketi henüz
// yüklenmediyse TR paketine düşer; ekran boş metinle çökmesin.
//
// Bileşenlerde değişken adı HEP `copy` olmalı: __tests__/cineswipe.test.js
// `copy.<anahtar>` kullanımlarını tarayıp iki dil paketinde var mı denetler.
import { useLanguage } from "../../context/LanguageContext";
import tr from "../../translations/tr.json";

export default function useCineCopy() {
  const { t } = useLanguage();
  return t.cineSwipe || tr.cineSwipe;
}
