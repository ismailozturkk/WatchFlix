// utils/betaFeatures.js
//
// Beta döneminde "henüz tam bitmemiş" sayılan özellikler. Buradaki kimliklerin
// giriş noktalarında components/common/BetaBadge.js ile "BETA" rozeti görünür.
//
// Bir özellik olgunlaşınca kimliğini bu listeden silmek yeter: rozet her yerden
// kalkar. Yayın öncesi tüm rozetleri kapatmak için BETA_BADGES_ENABLED = false.

export const BETA_BADGES_ENABLED = true;

export const BETA_FEATURE_IDS = Object.freeze([
  // Hub vitrin bölümleri (utils/sectionVisibility.js "hub" anahtarları)
  "league", // Haftalık Lig
  "challenges", // Meydan okumalar
  "tierlist", // Tier list
  "top100", // Seelogd Top 100
  // Oyunlar rayı / kartları
  "chain", // Film Zinciri
  "rating", // Puan yukarı-aşağı (hızlı oyun)
  "daily_frame", // Günün Karesi
  // Diğer giriş noktaları
  "film_club", // Film Kulübü
  "atmosphere", // Atmosfer (evren sahneleri, parçacıklar)
  "profile_banner", // Profil kapağı
  "app_icon", // Uygulama simgesi seçici
  "streak_flame", // Haftalık seri alevi (ayrıntı sayfası)
]);

const BETA_SET = new Set(BETA_FEATURE_IDS);

export function isBetaFeature(id) {
  return BETA_BADGES_ENABLED && !!id && BETA_SET.has(id);
}
