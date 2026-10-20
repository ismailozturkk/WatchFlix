// Dry run by default. Repairs derived root fields only, using a transactional
// snapshot and a local backup. Authentication uses the existing Firebase CLI.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const { transformSync } = require("@babel/core");

const rootDir = path.resolve(__dirname, "..");
const cache = new Map();
function loadPure(relative) {
  const filename = path.resolve(rootDir, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const { code } = transformSync(fs.readFileSync(filename, "utf8"), {
    filename, babelrc: false, configFile: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const localRequire = (request) => {
    if (!request.startsWith(".")) throw new Error("Expected a pure local module");
    return loadPure(path.resolve(path.dirname(filename), request + (path.extname(request) ? "" : ".js")));
  };
  new Function("require", "module", "exports", code)(localRequire, module, module.exports);
  return module.exports;
}

function decode(value) {
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, v]) => [key, decode(v)]));
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  return value.stringValue ?? value.timestampValue;
}
function encode(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, v]) => [key, encode(v)])) } };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  return { stringValue: String(value) };
}

async function main() {
  const uid = process.argv[process.argv.indexOf("--uid") + 1];
  if (!process.argv.includes("--uid") || !/^[A-Za-z0-9_-]+$/.test(uid || "")) throw new Error("--uid is required");
  const apply = process.argv.includes("--apply");
  const project = JSON.parse(fs.readFileSync(path.join(rootDir, ".firebaserc"), "utf8")).projects.default;
  const npmRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
  const auth = require(path.join(npmRoot, "firebase-tools/lib/auth.js"));
  const account = auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) throw new Error("Firebase CLI login unavailable");
  const token = await auth.getAccessToken(account.tokens.refresh_token, []);
  const database = `projects/${project}/databases/(default)`;
  const api = `https://firestore.googleapis.com/v1/${database}/documents`;
  const request = async (suffix, body) => {
    const response = await fetch(api + suffix, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`Firestore HTTP ${response.status}: ${(await response.json()).error?.message || "request failed"}`);
    return response.json();
  };
  const { transaction } = await request(":beginTransaction", { options: { readWrite: {} } });
  let committed = false;
  try {
    const root = await request(`/Lists/${uid}?transaction=${encodeURIComponent(transaction)}`);
    const raw = { root }, lists = {};
    for (const key of ["favorites", "watchList", "watchedMovies", "watchedTv", "customItems", "myRatings", "myComments"]) {
      const parent = key.startsWith("my") ? "Users" : "Lists";
      const rows = await request(`/${parent}/${uid}:runQuery`, { transaction, structuredQuery: { from: [{ collectionId: key }] } });
      raw[key] = rows.filter((row) => row.document).map((row) => row.document);
      lists[key] = Object.fromEntries(raw[key].map((entry) => {
        const docId = entry.name.split("/").pop();
        return [docId, { docId, ...decode({ mapValue: { fields: entry.fields } }) }];
      }));
    }
    const data = decode({ mapValue: { fields: root.fields } });
    const { buildImportedSummary } = loadPure("services/import/importSummary.js");
    const patch = buildImportedSummary(data, lists);
    const obsolete = Object.keys(data).filter((key) => /^(statusIndex|activityIndex|counts|stats)\./.test(key));
    const backup = path.join(os.tmpdir(), `seelogd-list-repair-${uid}-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify({ project, uid, ...raw, patch }, null, 2));
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", uid, backup, beforeCounts: data.counts, afterCounts: patch.counts,
      beforeIndex: Object.fromEntries(Object.entries(data.statusIndex || {}).map(([key, v]) => [key, Object.keys(v).length])),
      afterIndex: Object.fromEntries(Object.entries(patch.statusIndex).map(([key, v]) => [key, Object.keys(v).length])),
      ratings: Object.keys(patch.activityIndex.ratings).length, comments: patch.activityIndex.comments.length,
      beforeMinutes: data.stats?.totalMinutes, afterMinutes: patch.stats.totalMinutes, obsoleteFields: obsolete,
    }, null, 2));
    if (!apply) return;
    const fields = encode(patch).mapValue.fields;
    // Deleting a literal dotted key requires quoting the whole field name.
    await request(":commit", { transaction, writes: [{
      update: { name: root.name, fields },
      updateMask: { fieldPaths: [...Object.keys(patch), ...obsolete.map((key) => "`" + key.replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "`")] },
      currentDocument: { updateTime: root.updateTime },
      updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }],
    }] });
    committed = true;
    const verified = await request(`/Lists/${uid}`);
    const live = decode({ mapValue: { fields: verified.fields } });
    // Compare recursively without depending on Firestore's map key ordering.
    const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, stable(v[key])])) : v;
    for (const key of Object.keys(patch)) {
      if (JSON.stringify(stable(live[key])) !== JSON.stringify(stable(patch[key]))) throw new Error(`Verification failed for ${key}`);
    }
    if (obsolete.some((key) => Object.hasOwn(live, key))) throw new Error("Obsolete fields remain");
    for (const key of Object.keys(data).filter((key) => !Object.hasOwn(patch, key) && !obsolete.includes(key) && key !== "updatedAt")) {
      if (JSON.stringify(stable(data[key])) !== JSON.stringify(stable(live[key]))) throw new Error(`Unrelated field changed: ${key}`);
    }
    console.log("Verified: derived summaries repaired; unrelated root fields preserved. No list item, history, rating or comment document was written.");
  } finally {
    if (!committed) await request(":rollback", { transaction }).catch(() => {});
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
