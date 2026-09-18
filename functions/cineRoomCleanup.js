// Room data lives in one document; saved/shared user lists are independent.
function resultsDelivered(room) {
  return room?.status === "finished" && !!room.hostUid && !!room.guestUid &&
    room.resultsReceived?.includes(room.hostUid) && room.resultsReceived?.includes(room.guestUid);
}

async function deleteDeliveredRoom(db, ref) {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || !resultsDelivered(snapshot.data())) return false;
    transaction.delete(ref);
    return true;
  });
}

async function deleteExpiredRooms(db, Timestamp, now = Date.now()) {
  // Each query uses a single-field index. The second also cleans legacy rooms
  // without expiresAt. Re-read in a transaction: a final vote may extend expiry.
  const rooms = db.collection("CineRooms");
  const [expired, legacy] = await Promise.all([
    rooms.where("expiresAt", "<=", now).limit(200).get(),
    rooms.where("createdAt", "<=", Timestamp.fromMillis(now - 24 * 60 * 60 * 1000)).limit(200).get(),
  ]);
  const candidates = new Map([...expired.docs, ...legacy.docs].map((doc) => [doc.id, doc.ref]));
  let deleted = 0;
  for (const ref of candidates.values()) {
    deleted += await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return 0;
      const room = snapshot.data();
      const deadline = typeof room.expiresAt === "number"
        ? room.expiresAt : (room.createdAt?.toMillis?.() || now) + 24 * 60 * 60 * 1000;
      if (deadline > now) return 0;
      transaction.delete(ref);
      return 1;
    });
  }
  return deleted;
}

module.exports = { resultsDelivered, deleteDeliveredRoom, deleteExpiredRooms };
