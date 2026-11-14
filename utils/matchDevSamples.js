// utils/matchDevSamples.js
//
// Geliştirici Laboratuvarı > "Zevk Çemberleri: öneri durumları" için SAHTE öneri belgeleri (sunucu şekliyle aynı:
// functions/matchServer.js runNightly). Gerçek kişi yok; yapım anahtarları gerçek TMDB kimlikleri (afiş görünsün).
// Görsel denetim buradan yapılır (rehber Faz 6 madde 6).

const NOW = Date.UTC(2026, 10, 13, 1, 30);

const person = (n, extra = {}) => ({
  cid: `devcid_${String(n).padStart(6, "0")}`,
  displayName: ["Deniz", "Ece", "Mert", "Selin", "Arda", "Kerem"][n % 6],
  avatarIndex: (n * 3) % 12,
  photoURL: null,
  loved: ["movie_550", "movie_680", "movie_13"],
  split: "movie_27205",
  implicitHeavy: false,
  greeted: false,
  sent: false,
  ...extra,
});

const lane = (extra = {}) => ({ pool: 412, active: 388, inPool: true, twinsEnabled: true, items: [], circle: null, ...extra });
const doc = (movie, tv = null) => ({ v: 1, updatedAt: NOW, lanes: { movie, ...(tv ? { tv } : {}) } });

const circle = (extra = {}) => ({ key: "devcircle_abcdefgh", size: 6, genres: ["drama", "crime"], joined: false, joinedCount: 2, groupId: null, groupReady: false, ...extra });

/** id → { label, doc } (doc = null → gece işi henüz çalışmadı) */
export const MATCH_DEV_STATES = Object.freeze([
  { id: "not-ready", label: "Skor yok (ilk gece)", doc: null },
  { id: "low-data", label: "Az veri (havuzda değil)", doc: doc(lane({ inPool: false })) },
  { id: "empty", label: "Havuzda, aday yok", doc: doc(lane()) },
  {
    id: "cold",
    label: "Soğuk başlangıç (yüksek uyum)",
    doc: doc(lane({ pool: 42, active: 37, twinsEnabled: false, items: [person(1, { verdict: "near", score: 86 }), person(2, { verdict: "near", score: 81, implicitHeavy: true })] })),
  },
  {
    id: "twin",
    label: "İkiz + selam durumları",
    doc: doc(
      lane({
        items: [
          person(3, { verdict: "twin", score: 94 }),
          person(4, { verdict: "twin", score: 91, greeted: true }),
          person(5, { verdict: "near", score: 84, sent: true }),
          person(6, { verdict: "near", score: 82, sent: true, greeted: true, mutual: true }),
        ],
      }),
      lane({ items: [person(7, { verdict: "twin", score: 92, loved: ["tv_1396", "tv_1399", "tv_66732"], split: "tv_1402" })] }),
    ),
  },
  { id: "guide", label: "Rehber (yüzdesiz)", doc: doc(lane({ items: [person(8, { verdict: "guide", score: null })] })) },
  { id: "circle", label: "Çember daveti", doc: doc(lane({ items: [person(9, { verdict: "twin", score: 93 })], circle: circle() })) },
  {
    id: "circle-ready",
    label: "Çember: sohbet açıldı",
    doc: doc(lane({ items: [], circle: circle({ joinedCount: 4, groupReady: true }) })),
  },
]);
