// utils/devLabSamples.js
//
// Ayarlar > Geliştirici Laboratuvarı'nın rozet kutlaması örnekleri (saf; testte
// her örneğin gerçekten bir kutlamaya çözüldüğü denetlenir: __tests__/devLab.test.js).
//
import { WATCH_BADGES, AILE_PRESTIJ } from "../components/badges/watchBadgeCatalog";
import { BADGE_SETS } from "../components/badges/badgeSets";
import { RARITY_ORDER } from "../theme/badgeTokens";

// Örnek ödüller katalogdan seçilir (her nadirlikten ilki); kutlama, uygulamanın
// gerçek kodundan (showBadgeCelebration) geçer ama hiçbir şey kazanılmış sayılmaz.
const RARITY_LABELS = { common: "Yaygın", uncommon: "Seyrek", rare: "Nadir", epic: "Destansı", legendary: "Efsanevi" };
const firstOfRarity = (rarity) => WATCH_BADGES.find((b) => b.rarity === rarity)?.id;
const randomBadge = () => WATCH_BADGES[Math.floor(Math.random() * WATCH_BADGES.length)]?.id;
const prestigeFamily = Object.keys(AILE_PRESTIJ)[0];
export const DEV_BADGE_CELEBRATIONS = [
  ...RARITY_ORDER.map((r) => ({ label: RARITY_LABELS[r] || r, kutlama: () => ({ rozetler: [firstOfRarity(r)].filter(Boolean) }) })),
  { label: "Rastgele rozet", kutlama: () => ({ rozetler: [randomBadge()] }) },
  {
    label: "3 birden (+2)",
    kutlama: () => ({ rozetler: [firstOfRarity("common"), firstOfRarity("legendary"), firstOfRarity("rare")].filter(Boolean) }),
  },
  { label: "Koleksiyon", kutlama: () => ({ rozetler: [BADGE_SETS[0]?.id].filter(Boolean) }) },
  { label: "Dönem mührü", kutlama: () => ({ rozetler: [`muhur_${new Date().getFullYear()}_sonbahar`] }) },
  { label: "Prestij", kutlama: () => ({ rozetler: [`prestij_${prestigeFamily}_2`] }) },
  { label: "Perde atladı", kutlama: () => ({ perdeAtladi: true, yeniPerde: 5 }) },
  { label: "Makara atladı", kutlama: () => ({ makaraAtladi: true, yeniMakara: 2 }) },
];

