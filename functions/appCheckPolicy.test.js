const test = require("node:test");
const assert = require("node:assert/strict");

test("App Check zorunluluğu kapalı (Android VALID jeton üretene kadar AÇILMAZ — appCheckPolicy.js)", () => {
  assert.equal(require("./appCheckPolicy").APP_CHECK_ENFORCED, false);
});

test("her callable politikayı sarmalayıcıdan alır; tek tek enforceAppCheck yazılmaz", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "index.js"), "utf8");
  const explicit = src.match(/enforceAppCheck\s*:/g) || [];
  assert.equal(explicit.length, 2, "yalnız onCall sarmalayıcısındaki iki kullanım");
  assert.ok(!/onCallBase\(/.test(src.replace(/const onCall = [\s\S]*?;\n/, "")), "onCallBase yalnız sarmalayıcıda");
});
