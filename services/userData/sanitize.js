// services/userData/sanitize.js
//
// Firestore `undefined` alan değerini REDDEDER ("Unsupported field value:
// undefined") ve bir batch'teki tek bir kötü belge TÜM batch'i düşürür. Yerel
// kopya serbest biçimli nesnelerle çalıştığı için yazma günlüğüne girmeden önce
// bir kez temizliyoruz.
//
// Düz nesne/dizi dışındakilere (Firestore Timestamp, Date, FieldValue) DOKUNMAZ:
// onları bozmak sessiz tür değişikliği olurdu.

const isPlainObject = (value) => {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * `undefined` alanları atar; dizideki `undefined` değerleri `null` yapar
 * (Firestore dizi içinde `undefined` de kabul etmez). Girdiyi değiştirmez.
 */
export function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : stripUndefined(item)));
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) out[key] = stripUndefined(item);
    }
    return out;
  }
  return value;
}
