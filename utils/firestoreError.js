// utils/firestoreError.js
//
// Firestore onSnapshot dinleyicileri, kullanıcı çıkış yaptığı (signOut) anda
// kaçınılmaz olarak bir kez "permission-denied" hatası fırlatır: auth token
// geçersiz olur ama dinleyici henüz cleanup ile kapanmamıştır. Bu beklenen,
// zararsız bir yarış durumudur — konsolu ERROR ile doldurmasın diye susturuyoruz.
//
// Kullanım:
//   onSnapshot(ref, onNext, snapshotErrorHandler("Movies"))
//
// Gerçek (auth dışı) hatalar yine __DEV__ modunda uyarı olarak loglanır.

// Oturum geçişine bağlı, yok sayılabilir hata mı?
export function isAuthTransitionError(err) {
  const code = err?.code || "";
  return code === "permission-denied" || code === "unauthenticated";
}

// Hata raporlayıcı DIŞARIDAN enjekte edilir (App.js açılışta bağlar).
// Sentry'yi buradan import ETMİYORUZ: bu modül saf kalsın (jest onu import
// eden context'leri de yükleyebilsin) ve açılış sırasında Sentry'nin
// yüklenme anına bağımlılık oluşmasın.
let reporter = null;
export function setSnapshotErrorReporter(fn) {
  reporter = typeof fn === "function" ? fn : null;
}

// onSnapshot için standart hata callback'i üretir.
export function snapshotErrorHandler(label) {
  return (err) => {
    if (isAuthTransitionError(err)) return; // çıkış sırasında beklenen, sustur
    if (__DEV__) console.warn(`[${label}] snapshot error:`, err?.message || err);
    // Üretimde bu hatalar tamamen sessizdi: eksik index, hatalı kural veya
    // kota aşımı ekranı boş bırakır ve kimsenin haberi olmazdı.
    reporter?.(err, label);
  };
}
