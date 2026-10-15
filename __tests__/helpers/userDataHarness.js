// __tests__/helpers/userDataHarness.js
//
// services/userData için ortak test iskeleti: SAHTE BULUT + gerçek outbox /
// snapshotCache / cacheStore (bellek-içi dosya sistemi ve MMKV taklidi üstünde).
//
// `restart()` süreç ölümünü taklit eder: bellekteki her şey (ertelenmiş anlık
// görüntü yazımları DAHİL — çökmede kaybolurlar) düşer, MMKV ve dosyalar kalır.

/** Firestore'un yeterli bir taklidi: yol → belge. */
function makeRemote() {
  const db = new Map();
  const calls = { commit: [], fetchCollection: [], fetchDoc: [] };
  const control = { fail: null, hang: false };

  const remote = {
    db,
    calls,
    control,
    async commit(ops) {
      calls.commit.push(ops.map((op) => ({ ...op })));
      if (control.hang) return new Promise(() => {});
      const error = control.fail?.(ops);
      if (error) throw error;
      for (const op of ops) {
        if (op.op === "set") db.set(op.path, JSON.parse(JSON.stringify(op.data)));
        else db.delete(op.path);
      }
    },
    async fetchCollection(path) {
      calls.fetchCollection.push(path);
      const prefix = `${path}/`;
      return [...db.entries()]
        .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
        .map(([p, data]) => ({
          id: p.slice(prefix.length),
          data: JSON.parse(JSON.stringify(data)),
        }));
    },
    async fetchDoc(path) {
      calls.fetchDoc.push(path);
      return db.has(path) ? JSON.parse(JSON.stringify(db.get(path))) : null;
    },
    /** Buluta doğrudan belge koy (başka cihaz / eski veri). */
    seed(path, data) {
      db.set(path, JSON.parse(JSON.stringify(data)));
    },
    reads() {
      return calls.fetchCollection.length + calls.fetchDoc.length;
    },
  };
  return remote;
}

const err = (code, message) => Object.assign(new Error(message || code), { code });

function boot({ online = true, authed = true, workerOptions = {} } = {}) {
  jest.resetModules();
  require("expo-file-system").__reset();

  const env = { online, authed };
  const remote = makeRemote();
  const mods = {};

  function wire() {
    mods.snapshot = require("../../services/snapshotCache");
    mods.outbox = require("../../services/userData/outbox");
    mods.cacheStore = require("../../utils/cacheStore");
    mods.cacheKeys = require("../../utils/cacheKeys").cacheKeys;
    mods.domains = require("../../services/userData/domains");
    mods.marker = require("../../services/userData/hydrationMarker").marker;
    const { createUserDataDomain } = require("../../services/userData/createDomain");
    const { createSyncWorker } = require("../../services/userData/syncWorker");

    mods.worker = createSyncWorker({
      remote,
      outbox: mods.outbox,
      isOnline: () => env.online,
      isAuthed: () => env.authed,
      beforeAck: () => mods.snapshot.flushSnapshotWrites(),
      ...workerOptions,
    });
    const deps = {
      snapshot: mods.snapshot,
      outbox: mods.outbox,
      remote,
      requestFlush: (uid) => mods.worker.requestFlush(uid),
      canFetch: () => env.online && env.authed,
      marker: mods.marker,
    };
    mods.notes = createUserDataDomain(mods.domains.notesSpec, deps);
    mods.mediaNotes = createUserDataDomain(mods.domains.mediaNotesSpec, deps);
    mods.reminders = createUserDataDomain(mods.domains.remindersSpec, deps);
    mods.remindersActions = mods.domains.createRemindersActions(mods.reminders);
  }
  wire();

  const harness = {
    env,
    remote,
    mods,
    /** Süreç ölümü + yeniden açılış: bellek gider, MMKV + dosyalar kalır. */
    restart() {
      mods.snapshot.resetSnapshotCache(); // ertelenmiş (yazılmamış) anlık görüntüler kaybolur
      mods.outbox.__resetMemory();
      wire();
      return harness;
    },
  };
  return harness;
}

module.exports = { boot, makeRemote, err };
