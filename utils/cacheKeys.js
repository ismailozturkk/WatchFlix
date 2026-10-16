// utils/cacheKeys.js
//
// Offline cache anahtarları TEK kaynak. Hem dataDownloader (yazan) hem de
// context'ler (okuyan/yazan) buradan kullanır → "Verileri indir" ile dolan
// veriyi ekranlar birebir aynı anahtardan okur.
//
// Her üretici [namespace, key] döner → cacheStore.setJSON(...key(...), data).
//
// KALICI AD ALANLARI (utils/cacheStore.js DURABLE_NAMESPACES): notes, mediaNotes,
// aiConversations, reminders, lists. Bu anahtarların dosyaları sistemin silebileceği önbellek
// klasöründe değil belge dizininde durur — kullanıcının kendi verisinin yerel
// kopyası KAYNAKTIR (bkz. services/userData, docs/mimari/YEREL_ONCELIKLI_VERI_KATMANI.md).
// Anahtar şekli ve disk biçimi (dizi/harita) değişmez.

export const cacheKeys = {
  profile: (uid) => ["profile", uid],                  // obje: { uid, ...userDoc }
  notes: (uid) => ["notes", uid],                      // dizi: [{ ...note, id }] (createdAt desc)
  mediaNotes: (uid) => ["mediaNotes", uid],             // dizi: [{ ...mediaNote, id }] (updatedAt desc)
  aiConversations: (uid) => ["aiConversations", uid],   // dizi: [{ ...sohbet, id }] (updatedAt desc)
  reminders: (uid, kind) => ["reminders", `${uid}:${kind}`], // kind: 'movies'|'episodes' → dizi
  lists: (uid, name) => ["lists", `${uid}:${name}`],   // name: root|favorites|watchList|watchedMovies|watchedTv
  activity: (uid) => ["activity", uid],                // obje: { ratings, comments, likes, bookmarks, posts }
  // TÜRETİLMİŞ istatistikler. Diğerlerinin aksine `dataDownloader` bunu
  // doldurmaz — kaynağı (lists/*) zaten indiriliyor, burada saklanan o kaynaktan
  // hesaplanmış SONUÇ. Amaç açılışta ağır türetmeyi tekrarlamamak; kayıt yoksa
  // ekran eskisi gibi listener'dan hesaplar.
  stats: (uid) => ["stats", uid],                      // obje: { ...sayaçlar }
};
