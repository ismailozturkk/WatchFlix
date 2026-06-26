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

// onSnapshot için standart hata callback'i üretir.
export function snapshotErrorHandler(label) {
  return (err) => {
    if (isAuthTransitionError(err)) return; // çıkış sırasında beklenen, sustur
    if (__DEV__) console.warn(`[${label}] snapshot error:`, err?.message || err);
  };
}
