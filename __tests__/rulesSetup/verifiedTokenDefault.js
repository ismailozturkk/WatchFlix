// Kural testleri: e-posta doğrulama kapısı (firestore.rules → emailVerified()) gelince
// `authenticatedContext(uid)` ile kurulan her test kullanıcısı DOĞRULANMIŞ sayılır —
// mevcut testler başka bir davranışı sınıyor. Doğrulanmamış hesabı sınamak için token'ı
// açıkça ver: authenticatedContext(uid, { email_verified: false, firebase: { sign_in_provider: "password" } }).
const rut = require("@firebase/rules-unit-testing");

const original = rut.initializeTestEnvironment;
rut.initializeTestEnvironment = async (...args) => {
  const env = await original(...args);
  const authenticated = env.authenticatedContext.bind(env);
  env.authenticatedContext = (uid, tokenOptions) =>
    authenticated(uid, { email_verified: true, ...(tokenOptions || {}) });
  return env;
};
