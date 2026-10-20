// hooks/useDecorVisibility.js
//
// Bir ekranın (grubunun) hangi dekor efektlerine izin verdiğini döner:
// { snow, icon, ambient } — kullanıcının "ekran bazında" seçimi. Genel anahtar
// (kar/ikon/ambiyans düğmesi) burada DEĞİL; her efekt bileşeni onu kendisi okur.
// Efekt ancak ikisi de açıksa görünür.
//
// `scope` yoksa süzgeç yok (hepsi true). `effects` verilirse listede olmayanlar
// false — o ekran zaten o efekti hiç çizmiyor demektir.

import { useDecorScopeSettings } from "../context/AppSettingsContext";
import { decorVisibility } from "../utils/decorScopes";

export default function useDecorVisibility(scope, effects) {
  const { decorHidden } = useDecorScopeSettings();
  return decorVisibility(decorHidden, scope, effects);
}
