"use strict";

const { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } = require("jose");

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const appleJwks = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

async function verifyAppleIdentityToken(identityToken, clientId) {
  const { payload } = await jwtVerify(identityToken, appleJwks, {
    issuer: APPLE_ISSUER,
    audience: clientId,
    algorithms: ["RS256"],
  });
  if (
    !payload.sub ||
    !payload.email ||
    !(payload.email_verified === true || payload.email_verified === "true")
  ) {
    throw new Error("Apple identity claims are incomplete");
  }
  return payload;
}

async function createAppleClientSecret({ teamId, clientId, keyId, privateKey }) {
  const normalizedKey = String(privateKey || "").replace(/\\n/g, "\n");
  const key = await importPKCS8(normalizedKey, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

async function postAppleForm(url, values, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values).toString(),
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Apple endpoint failed: ${response.status}:${body.error || "unknown"}`);
  }
  return body;
}

async function revokeAppleAuthorizationCode(
  authorizationCode,
  { teamId, clientId, keyId, privateKey },
  fetchImpl = fetch,
) {
  const clientSecret = await createAppleClientSecret({
    teamId,
    clientId,
    keyId,
    privateKey,
  });
  const tokenResponse = await postAppleForm(
    APPLE_TOKEN_URL,
    {
      client_id: clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: "authorization_code",
    },
    fetchImpl,
  );
  const token = tokenResponse.refresh_token || tokenResponse.access_token;
  if (!token) throw new Error("Apple token exchange returned no revocable token");
  await postAppleForm(
    APPLE_REVOKE_URL,
    {
      client_id: clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: tokenResponse.refresh_token
        ? "refresh_token"
        : "access_token",
    },
    fetchImpl,
  );
}

module.exports = {
  APPLE_ISSUER,
  APPLE_REVOKE_URL,
  APPLE_TOKEN_URL,
  createAppleClientSecret,
  revokeAppleAuthorizationCode,
  verifyAppleIdentityToken,
};
