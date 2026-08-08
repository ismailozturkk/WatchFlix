// __mocks__/expo-file-system.js
//
// Bellek ici dosya sistemi. utils/cacheStore.js (Firestore verisinin offline
// deposu) bu API'ye dayaniyor ve native oldugu icin jest node ortaminda
// (bkz. jest.config.js) require edilemiyordu — yani projenin TUM offline
// katmani test edilemiyordu.
//
// Yalnizca cacheStore'un kullandigi yuzey saglanir: File/Directory/Paths,
// exists, create, write, textSync, delete, list, size.

const dosyalar = new Map(); // tam yol -> icerik (string)
const dizinler = new Set(["/cache"]);

const birlestir = (taban, ad) => `${String(taban).replace(/\/+$/, "")}/${ad}`;

class Directory {
  constructor(taban, ad) {
    this.uri = ad === undefined ? String(taban) : birlestir(taban, ad);
  }
  get exists() {
    return dizinler.has(this.uri);
  }
  create({ intermediates = false } = {}) {
    if (intermediates) {
      const parcalar = this.uri.split("/").filter(Boolean);
      let yol = "";
      for (const p of parcalar) {
        yol += "/" + p;
        dizinler.add(yol);
      }
      return;
    }
    dizinler.add(this.uri);
  }
  delete() {
    const onek = this.uri + "/";
    for (const yol of Array.from(dosyalar.keys())) {
      if (yol.startsWith(onek)) dosyalar.delete(yol);
    }
    for (const yol of Array.from(dizinler)) {
      if (yol === this.uri || yol.startsWith(onek)) dizinler.delete(yol);
    }
  }
  /** Dogrudan alt ogeler (File/Directory). */
  list() {
    const onek = this.uri + "/";
    const cocuklar = [];
    const gorulen = new Set();

    for (const yol of dosyalar.keys()) {
      if (!yol.startsWith(onek)) continue;
      const kalan = yol.slice(onek.length);
      if (kalan.includes("/")) continue;
      cocuklar.push(new File(this.uri, kalan));
    }
    for (const yol of dizinler) {
      if (!yol.startsWith(onek)) continue;
      const kalan = yol.slice(onek.length);
      const ilk = kalan.split("/")[0];
      if (!ilk || gorulen.has(ilk)) continue;
      gorulen.add(ilk);
      cocuklar.push(new Directory(this.uri, ilk));
    }
    return cocuklar;
  }
}

class File {
  constructor(taban, ad) {
    this.uri = ad === undefined ? String(taban) : birlestir(taban.uri ?? taban, ad);
  }
  get exists() {
    return dosyalar.has(this.uri);
  }
  get size() {
    const icerik = dosyalar.get(this.uri);
    return icerik === undefined ? 0 : icerik.length;
  }
  write(icerik) {
    dosyalar.set(this.uri, String(icerik));
  }
  textSync() {
    const icerik = dosyalar.get(this.uri);
    if (icerik === undefined) throw new Error(`Dosya yok: ${this.uri}`);
    return icerik;
  }
  text() {
    return Promise.resolve(this.textSync());
  }
  delete() {
    dosyalar.delete(this.uri);
  }
}

// cacheStore `new Directory(ROOT, ad)` ile ROOT'u taban olarak veriyor;
// Directory/File kurucularinin hem string hem nesne kabul etmesi bu yuzden.
const cozTaban = (taban) => (taban && taban.uri ? taban.uri : taban);
const OrijinalDirectory = Directory;
class DirectoryProxy extends OrijinalDirectory {
  constructor(taban, ad) {
    super(cozTaban(taban), ad);
  }
}

const Paths = { cache: "/cache", document: "/document" };

module.exports = {
  File,
  Directory: DirectoryProxy,
  Paths,
  /** Test yardimcisi: her seyi sil. */
  __reset() {
    dosyalar.clear();
    dizinler.clear();
    dizinler.add("/cache");
  },
  /** Test yardimcisi: ham dosya haritasi. */
  __files: dosyalar,
};
