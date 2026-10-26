// fieldOverrides bir alanın VARSAYILAN tek alanlı dizinlerinin yerine geçer:
// yalnız COLLECTION_GROUP yazılırsa koleksiyon kapsamlı eşitlik sorgusu
// "requires a COLLECTION_ASC index" hatasıyla düşer.
//
// T3 B13 doğrulamasında görüldü: notifications.fromUid yalnız grup kapsamlıydı;
// arkadaşlıktan çıkarmanın bildirim temizliği (friendsService.deleteDirectChat)
// ve sohbetten davet kabulü (notificationsService.acceptMatchingInvitations)
// canlıda hep hata veriyordu.

const fs = require("fs");
const path = require("path");

const indexes = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "firestore.indexes.json"), "utf8"),
);

// İstemcinin TEK koleksiyonda eşitlikle sorguladığı, override'ı olan alanlar.
const COLLECTION_SCOPED_QUERIES = [{ collectionGroup: "notifications", fieldPath: "fromUid" }];

test.each(COLLECTION_SCOPED_QUERIES)(
  "$collectionGroup.$fieldPath override'ı koleksiyon kapsamlı ASC dizini korur",
  ({ collectionGroup, fieldPath }) => {
    const override = (indexes.fieldOverrides || []).find(
      (f) => f.collectionGroup === collectionGroup && f.fieldPath === fieldPath,
    );
    expect(override).toBeDefined();
    expect(override.indexes).toEqual(
      expect.arrayContaining([{ order: "ASCENDING", queryScope: "COLLECTION" }]),
    );
  },
);
