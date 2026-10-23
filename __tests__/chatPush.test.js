// Giden mesajın push kararı (utils/chatPush.js).
//
// Bozulursa: düz mesaj işaretsiz giderse sunucu onu yok sayar ve alıcıya HİÇ
// bildirim gitmez (istemci artık bildirim belgesi yazmıyor); davet işaretlenirse
// hem bildirim belgesinden hem mesaj tetikleyicisinden ÇİFT push gider.

import { SERVER_PUSH, prepareOutgoingMessage } from "../utils/chatPush";
import { buildShareMessage } from "../utils/chatShare";

const SERVER_MARKER = require("../functions/socialPush").SERVER_PUSH_MARKER;

describe("prepareOutgoingMessage", () => {
  test("düz metin mesajı sunucu push işaretini alır, davet yok", () => {
    const { message, invitation } = prepareOutgoingMessage({ text: "selam", senderId: "me" });
    expect(message).toEqual({ text: "selam", senderId: "me", push: SERVER_PUSH });
    expect(invitation).toBeNull();
  });

  test("girdi nesnesi değiştirilmez", () => {
    const input = { text: "selam", senderId: "me" };
    prepareOutgoingMessage(input);
    expect(input).toEqual({ text: "selam", senderId: "me" });
  });

  test("CineSwipe daveti işaretsiz kalır, davet alanlarını döndürür", () => {
    const fields = buildShareMessage({ type: "cineRoom", code: "123456" });
    expect(fields).toBeTruthy();
    const { message, invitation } = prepareOutgoingMessage({ ...fields, senderId: "me" });
    expect(message.push).toBeUndefined();
    expect(invitation).toEqual({ type: "cineswipe_invite", inviteCode: "123456" });
  });

  test("istemci ve sunucu işareti aynı değer", () => {
    expect(SERVER_PUSH).toBe(SERVER_MARKER);
  });
});
