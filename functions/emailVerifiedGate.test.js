const test = require("node:test");
const assert = require("node:assert/strict");
const { isEmailVerifiedAuth, requireVerified } = require("./emailVerifiedGate");

const auth = (token) => ({ uid: "u1", token });
const codeOf = (fn) => {
  try {
    fn();
  } catch (error) {
    return error.code;
  }
  return "ok";
};

test("doğrulanmış e-posta geçer, uid döner", () => {
  assert.equal(requireVerified({ auth: auth({ email_verified: true, firebase: { sign_in_provider: "password" } }) }), "u1");
});

test("doğrulanmamış e-posta+şifre hesabı reddedilir", () => {
  const request = { auth: auth({ email_verified: false, firebase: { sign_in_provider: "password" } }) };
  assert.equal(isEmailVerifiedAuth(request.auth), false);
  assert.equal(codeOf(() => requireVerified(request)), "permission-denied");
});

test("email_verified iddiası hiç yoksa reddedilir", () => {
  assert.equal(codeOf(() => requireVerified({ auth: auth({}) })), "permission-denied");
});

test("Google / Apple oturumu sağlayıcıda doğrulanmış sayılır", () => {
  for (const provider of ["google.com", "apple.com"]) {
    assert.equal(isEmailVerifiedAuth(auth({ firebase: { sign_in_provider: provider } })), true, provider);
  }
});

test("oturumsuz çağrı unauthenticated", () => {
  assert.equal(codeOf(() => requireVerified({})), "unauthenticated");
});
