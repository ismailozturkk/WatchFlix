// utils/cacheKeys.js
//
// Offline cache anahtarları TEK kaynak. Hem dataDownloader (yazan) hem de
// context'ler (okuyan/yazan) buradan kullanır → "Verileri indir" ile dolan
// veriyi ekranlar birebir aynı anahtardan okur.
//
// Her üretici [namespace, key] döner → cacheStore.setJSON(...key(...), data).

export const cacheKeys = {
  profile: (uid) => ["profile", uid],                  // obje: { uid, ...userDoc }
  notes: (uid) => ["notes", uid],                      // dizi: [{ ...note, id }] (createdAt desc)
  reminders: (uid, kind) => ["reminders", `${uid}:${kind}`], // kind: 'movies'|'episodes' → dizi
  lists: (uid, name) => ["lists", `${uid}:${name}`],   // name: root|favorites|watchList|watchedMovies|watchedTv
  activity: (uid) => ["activity", uid],                // obje: { ratings, comments, likes, bookmarks, posts }
  // TÜRETİLMİŞ istatistikler. Diğerlerinin aksine `dataDownloader` bunu
  // doldurmaz — kaynağı (lists/*) zaten indiriliyor, burada saklanan o kaynaktan
  // hesaplanmış SONUÇ. Amaç açılışta ağır türetmeyi tekrarlamamak; kayıt yoksa
  // ekran eskisi gibi listener'dan hesaplar.
  stats: (uid) => ["stats", uid],                      // obje: { ...sayaçlar }
};
