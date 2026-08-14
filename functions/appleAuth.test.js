"use strict";

const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
const test = require("node:test");
const {
  APPLE_REVOKE_URL,
  APPLE_TOKEN_URL,
  createAppleClientSecret,
  revokeAppleAuthorizationCode,
} = require("./appleAuth");

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
const config = {
  teamId: "KN77DDXC9U",
  clientId: "com.smlztrk.seelogd",
  keyId: "TESTKEY123",
  privateKey: privateKeyPem,
};

test("Apple client secret dogru issuer, subject ve key id ile imzalanir", async () => {
  const token = await createAppleClientSecret(config);
  const [headerPart, payloadPart] = token.split(".");
  const header = JSON.parse(Buffer.from(headerPart, "base64url").toString());
  const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString());

  assert.equal(header.alg, "ES256");
  assert.equal(header.kid, config.keyId);
  assert.equal(payload.iss, config.teamId);
  assert.equal(payload.sub, config.clientId);
  assert.equal(payload.aud, "https://appleid.apple.com");
  assert.ok(payload.exp > payload.iat);
});

test("authorization code tokena cevrilir ve refresh token iptal edilir", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, body: new URLSearchParams(options.body) });
    if (url === APPLE_TOKEN_URL) {
      return { ok: true, json: async () => ({ refresh_token: "refresh-token" }) };
    }
    return { ok: true, json: async () => ({}) };
  };

  await revokeAppleAuthorizationCode("authorization-code", config, fetchImpl);

  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, APPLE_TOKEN_URL);
  assert.equal(requests[0].body.get("code"), "authorization-code");
  assert.equal(requests[0].body.get("grant_type"), "authorization_code");
  assert.equal(requests[1].url, APPLE_REVOKE_URL);
  assert.equal(requests[1].body.get("token"), "refresh-token");
  assert.equal(requests[1].body.get("token_type_hint"), "refresh_token");
});
