"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { APP_DATABASE_URL } = require("./rtdbInstance");

test("sunucu, istemcinin yazdığı RTDB örneğine bağlanır (varsayılan boş örneğe değil)", () => {
  assert.strictEqual(APP_DATABASE_URL, "https://movieandtv-2832a.europe-west1.firebasedatabase.app");
  const source = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
  assert.ok(source.includes("rtdb = getDatabaseWithUrl(APP_DATABASE_URL);"));
  // Argümansız getDatabase() projenin varsayılan (boş) örneğini açar.
  assert.ok(!source.includes("getDatabase()"));
});

test("firebase.json kuralları uygulamanın örneğine de gönderir", () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "firebase.json"), "utf8"));
  const instances = [].concat(config.database).map((entry) => entry.instance);
  assert.ok(instances.includes("movieandtv-2832a"), "uygulamanın RTDB örneği firebase.json'da yok");
});
