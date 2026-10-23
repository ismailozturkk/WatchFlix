// services/chatMessagePager.js
//
// Sohbet mesajları için imleçli sayfa yöneticisi (1-1 ve grup; ChatScreen kullanır).
//
// ESKİ: tek dinleyici `orderBy(timestamp desc) + limit(n)`; "daha eski" n'i
// büyütüp dinleyiciyi YENİDEN kuruyordu. Yeni bir sorgu = sunucu bütün pencereyi
// baştan gönderir: 20 → 40 → 60 … 200 mesaja inmek ~1100 okuma. Mesaja atlama
// +50'lik adımlarla aynısını yapıyordu.
//
// YENİ: sayfa başına AYRI dinleyici, sınırlar belge imleçleriyle sabit:
//   • sayfa 0 (en yeni): `limit(pageSize)` — açılış.
//   • İLK "daha eski"de sayfa 0 o anki en eski belgesine ÇAPALANIR
//     (`endAt(imleç)`, limitsiz). Çapasız kalsa yeni mesaj geldikçe pencere kayar
//     ve imlecin üstündeki mesajlar listeden düşerdi — sayfa 1 onları kapsamaz.
//     Çapalama sayfa 0'ı BİR KEZ yeniden okutur.
//   • sayfa k: `startAfter(önceki sayfanın en eski belgesi) + limit(size)`. Yeni
//     mesajlar imlecin önünde kaldığından pencere kaymaz; düzenleme, silme ve
//     anket oyları her sayfada CANLI kalır.
// Toplam okuma ≈ yüklenen mesaj sayısı (+ bir kez sayfa 0). Silinen mesaj sayfa
// penceresine bir sonraki sayfanın ilk belgesini çekebilir → kimliğe göre tekilleşir.
//
// Firestore fonksiyonları dışarıdan verilir (`fs`): __tests__/chatMessagePager.test.js
// sahte sorgu motoruyla sınar.

/**
 * @param {object} p
 * @param {*} p.messagesRef                 messages koleksiyon referansı
 * @param {{ query, orderBy, limit, startAfter, endAt, onSnapshot }} p.fs
 * @param {number} [p.pageSize]
 * @param {(docSnap: any) => object} p.mapDoc   belge → mesaj nesnesi (`id` şart)
 * @param {(state: { messages: object[], loaded: boolean, hasMore: boolean, loadingOlder: boolean }) => void} p.onChange
 * @param {(error: Error) => void} [p.onError]
 * @param {(count: number) => void} [p.onReads]  değişen belge sayısı (okuma takibi)
 */
export function createMessagePager({
  messagesRef,
  fs,
  pageSize = 30,
  mapDoc,
  onChange,
  onError,
  onReads,
}) {
  const pages = []; // indeks = sayfa; { unsub, docs, oldest, full, loaded }
  let anchored = false;
  let loadingKey = null;
  let stopped = false;
  // Sayfa 0 bir kez yüklendiyse liste "yüklendi" kalır: çapalamada yeniden
  // kurulan dinleyici `loaded`ı geçici olarak düşürür, ekran bunu boş sohbet
  // ya da ilk açılış sanmasın.
  let firstLoaded = false;

  const pageQuery = (...constraints) =>
    fs.query(messagesRef, fs.orderBy("timestamp", "desc"), ...constraints);

  const lastPage = () => pages[pages.length - 1];
  const hasMore = () => {
    const last = lastPage();
    return Boolean(last?.loaded && last.full && last.oldest);
  };

  function emit() {
    if (stopped) return;
    const seen = new Set();
    const messages = [];
    for (const page of pages) {
      for (const message of page?.docs || []) {
        if (seen.has(message.id)) continue;
        seen.add(message.id);
        messages.push(message);
      }
    }
    onChange({
      messages,
      loaded: firstLoaded,
      hasMore: hasMore(),
      loadingOlder: loadingKey !== null,
    });
  }

  // Sayfayı (yeniden) dinler. Yeniden kurulan sayfa (çapalama) eski içeriğini
  // yeni anlık görüntü gelene dek gösterir; eski dinleyici yenisi kurulduktan
  // SONRA kapanır (arada boş liste/titreme olmasın).
  function listen(key, query, sizeLimit) {
    const previous = pages[key];
    const page = {
      unsub: null,
      docs: previous?.docs || [],
      oldest: previous?.oldest || null,
      full: false,
      loaded: false,
    };
    pages[key] = page;
    page.unsub = fs.onSnapshot(
      query,
      (snap) => {
        if (stopped || pages[key] !== page) return;
        onReads?.(typeof snap.docChanges === "function" ? snap.docChanges().length : snap.docs.length);
        page.docs = snap.docs.map(mapDoc);
        page.oldest = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
        page.full = sizeLimit != null && snap.docs.length >= sizeLimit;
        page.loaded = true;
        if (key === 0) firstLoaded = true;
        if (loadingKey === key) loadingKey = null;
        emit();
      },
      (error) => {
        if (stopped || pages[key] !== page) return;
        if (loadingKey === key) loadingKey = null;
        onError?.(error);
        emit();
      },
    );
    previous?.unsub?.();
  }

  /**
   * Bir sonraki eski sayfayı yükler.
   * @param {number} [size] sayfa boyutu (mesaja atlamada daha büyük verilir)
   * @returns {"started" | "busy" | "end"}
   */
  function loadOlder(size = pageSize) {
    if (stopped) return "end";
    if (loadingKey !== null) return "busy";
    const last = lastPage();
    if (!last?.loaded) return "busy";
    if (!hasMore()) return "end";
    const cursor = last.oldest;
    if (!anchored) {
      anchored = true;
      listen(0, pageQuery(fs.endAt(cursor)), null);
    }
    const key = pages.length;
    loadingKey = key;
    listen(key, pageQuery(fs.startAfter(cursor), fs.limit(size)), size);
    emit();
    return "started";
  }

  function stop() {
    stopped = true;
    for (const page of pages) page?.unsub?.();
  }

  listen(0, pageQuery(fs.limit(pageSize)), pageSize);

  return { loadOlder, stop };
}
