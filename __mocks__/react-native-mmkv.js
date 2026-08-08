// __mocks__/react-native-mmkv.js
//
// Jest, node_modules paketleri için kök `__mocks__` klasörünü OTOMATİK kullanır
// (jest.mock çağrısına gerek yok). Bu dosya olmadan her test kendi kısmi
// taklidini yazmak zorunda kalırdı — AsyncStorage döneminde tam olarak bu
// oluyordu: dört test dosyası, dört farklı ve eksik taklit.
//
// Gerçek MMKV'nin dahili bir test mock'u var ama `react-native`i import ediyor;
// bu repoda jest saf node ortamında koştuğu için burada bellek-içi bir eşdeğer
// tutuyoruz. TİP KATILIĞI gerçek davranışı birebir taklit eder: bir sayı
// yazılıp `getString` ile okunursa `undefined` döner — codec bu ayrıma dayanıyor.

const instances = new Map();

function makeInstance(id) {
  const map = new Map();
  const listeners = new Set();

  const emit = (key) => {
    for (const fn of Array.from(listeners)) {
      try {
        fn(key);
      } catch {
        // dinleyici hatası diğerlerini düşürmesin
      }
    }
  };

  const typed = (key, expected) => {
    const value = map.get(key);
    return typeof value === expected ? value : undefined;
  };

  return {
    id,
    get length() {
      return map.size;
    },
    get size() {
      return map.size;
    },
    get byteSize() {
      let total = 0;
      for (const [k, v] of map) total += k.length + String(v).length;
      return total;
    },
    isReadOnly: false,
    isEncrypted: false,

    set(key, value) {
      if (!key) throw new Error("MMKV: key boş olamaz");
      map.set(key, value);
      emit(key);
    },
    getString: (key) => typed(key, "string"),
    getNumber: (key) => typed(key, "number"),
    getBoolean: (key) => typed(key, "boolean"),
    getBuffer: () => undefined,
    contains: (key) => map.has(key),
    remove(key) {
      const had = map.delete(key);
      if (had) emit(key);
      return had;
    },
    getAllKeys: () => Array.from(map.keys()),
    clearAll() {
      const keys = Array.from(map.keys());
      map.clear();
      keys.forEach(emit);
    },
    recrypt() {},
    encrypt() {},
    decrypt() {},
    trim() {},
    checkContentChanged() {},
    addOnValueChangedListener(fn) {
      listeners.add(fn);
      return { remove: () => listeners.delete(fn) };
    },
    importAllFrom(other) {
      let count = 0;
      for (const key of other.getAllKeys()) {
        const value =
          other.getString(key) ?? other.getNumber(key) ?? other.getBoolean(key);
        if (value !== undefined) {
          map.set(key, value);
          count += 1;
        }
      }
      return count;
    },
  };
}

export function createMMKV(configuration) {
  const id = configuration?.id ?? "mmkv.default";
  let instance = instances.get(id);
  if (!instance) {
    instance = makeInstance(id);
    instances.set(id, instance);
  }
  return instance;
}

export function existsMMKV(id) {
  return instances.has(id);
}

export function deleteMMKV(id) {
  return instances.delete(id);
}

/** Testler arasında tüm örnekleri sıfırlar. */
export function __resetAllMMKV() {
  instances.clear();
}
