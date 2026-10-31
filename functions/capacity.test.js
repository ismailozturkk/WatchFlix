// Bekçi: her export edilen fonksiyon instance tavanını AÇIKÇA seçer (CAPACITY.* ya da
// literal maxInstances). Yeni fonksiyon eklenip tavanı unutulursa bu test düşer.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { CAPACITY } = require("./capacity");

const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");

function exportedFunctions() {
  const re = /^exports\.(\w+)\s*=\s*([\s\S]*?)(?=async\s*\()/gm;
  const out = [];
  let m;
  while ((m = re.exec(source))) out.push({ name: m[1], head: m[2] });
  return out;
}

test("her fonksiyon tavanını açıkça seçiyor", () => {
  const fns = exportedFunctions();
  assert.ok(fns.length >= 25, `beklenenden az export bulundu: ${fns.length}`);
  const missing = fns
    .filter(({ head }) => !/CAPACITY\.\w+|maxInstances\s*:/.test(head))
    .map(({ name }) => name);
  assert.deepEqual(missing, []);
});

test("kotalı uçlar ve tetikleyiciler ucuz callable'lardan geniş değil", () => {
  assert.ok(CAPACITY.upstream.maxInstances <= CAPACITY.light.maxInstances);
  assert.ok(CAPACITY.trigger.maxInstances <= CAPACITY.light.maxInstances);
  assert.equal(CAPACITY.singleton.maxInstances, 1);
});

test("üçüncü taraf çağıran callable'lar upstream sınıfında", () => {
  const byName = Object.fromEntries(exportedFunctions().map((f) => [f.name, f.head]));
  for (const name of ["callGemini", "getExternalRatings", "syncPremiumStatus", "revokeAppleAuthorization"]) {
    assert.match(byName[name] || "", /CAPACITY\.upstream/, name);
  }
});

test("gen1 fonksiyonu runWith ile sınırlı (setGlobalOptions gen1'e uygulanmaz)", () => {
  assert.match(source, /functionsV1\s*\.runWith\(CAPACITY\.\w+\)/);
});
