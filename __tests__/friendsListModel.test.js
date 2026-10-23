// Arkadaş / mesaj / istek ekranlarının liste mantığı (utils/friendsListModel.js).
//
// Bozulursa: arkadaş listesi yanlış sıralanır ("İsmail" sona düşer), süzme
// kutusu kısa listede çıkar ya da "@ali" araması hiçbir şey bulmaz, sekmedeki
// okunmamış sayısı yanlış gösterilir, grup satırı okunmamış mesajı hiç vurgulamaz.

import {
  FILTER_MIN_ITEMS,
  filterConversations,
  filterGroups,
  foldForSearch,
  groupPeopleByInitial,
  groupUnreadCount,
  groupUnreadRecipients,
  initialOf,
  personMatchesQuery,
  shouldShowFilter,
  sortPeopleByName,
  toEpochMs,
  totalGroupUnread,
  totalUnread,
} from "../utils/friendsListModel";

const p = (displayName, username = "") => ({ uid: displayName, displayName, username });

describe("shouldShowFilter", () => {
  test("eşik altında gizli, eşikte ve üstünde görünür", () => {
    expect(shouldShowFilter(0)).toBe(false);
    expect(shouldShowFilter(FILTER_MIN_ITEMS - 1)).toBe(false);
    expect(shouldShowFilter(FILTER_MIN_ITEMS)).toBe(true);
    expect(shouldShowFilter(120)).toBe(true);
  });

  test("bozuk değer gizli sayılır", () => {
    expect(shouldShowFilter(undefined)).toBe(false);
    expect(shouldShowFilter("x")).toBe(false);
  });
});

describe("personMatchesQuery", () => {
  const ali = p("Ali Yılmaz", "aliy");

  test("boş sorgu herkesi geçirir", () => {
    expect(personMatchesQuery(ali, "")).toBe(true);
    expect(personMatchesQuery(ali, "   ")).toBe(true);
  });

  test("ad ve kullanıcı adında, büyük/küçük harf duyarsız arar", () => {
    expect(personMatchesQuery(ali, "yılm")).toBe(true);
    expect(personMatchesQuery(ali, "ALIY")).toBe(true);
    expect(personMatchesQuery(ali, "veli")).toBe(false);
  });

  test("baştaki @ yok sayılır", () => {
    expect(personMatchesQuery(ali, "@aliy")).toBe(true);
  });

  test("Türkçe i/İ/ı/I ayrımına takılmaz: 'ALI' da 'ali' de 'Ali'yi bulur", () => {
    expect(personMatchesQuery(p("Ali"), "ALI")).toBe(true);
    expect(personMatchesQuery(p("İsmail"), "ismail")).toBe(true);
    expect(personMatchesQuery(p("İsmail"), "İSMAİL")).toBe(true);
    expect(personMatchesQuery(p("ISPARTA"), "ısp")).toBe(true);
    expect(personMatchesQuery(p("Irmak"), "ırmak")).toBe(true);
  });

  test("aksan yazmadan da bulur: 'cagla' → Çağla, 'sule' → Şule", () => {
    expect(personMatchesQuery(p("Çağla"), "cagla")).toBe(true);
    expect(personMatchesQuery(p("Şule Öztürk"), "sule ozt")).toBe(true);
    expect(personMatchesQuery(p("Cem"), "çem")).toBe(true);
  });

  test("eksik alanlar patlatmaz", () => {
    expect(personMatchesQuery({}, "a")).toBe(false);
    expect(personMatchesQuery(null, "a")).toBe(false);
    expect(personMatchesQuery(null, "")).toBe(true);
  });
});

describe("foldForSearch", () => {
  test("İ/I/ı → i, küçük harf, aksan yok", () => {
    expect(foldForSearch("İSMAİL ILGAZ")).toBe("ismail ilgaz");
    expect(foldForSearch("Çağla Şahin Öğüt")).toBe("cagla sahin ogut");
  });

  test("boş / bozuk değer boş metin", () => {
    expect(foldForSearch(null)).toBe("");
    expect(foldForSearch(undefined)).toBe("");
    expect(foldForSearch(42)).toBe("42");
  });
});

describe("sortPeopleByName / groupPeopleByInitial", () => {
  test("Türkçe alfabeye göre sıralar: İ, I'dan sonra gelir; Ç, C'den sonra", () => {
    const sorted = sortPeopleByName([p("İpek"), p("Zeynep"), p("Çağla"), p("Cem"), p("Ali"), p("Irmak")], "tr");
    expect(sorted.map((x) => x.displayName)).toEqual(["Ali", "Cem", "Çağla", "Irmak", "İpek", "Zeynep"]);
  });

  test("girdi dizisini değiştirmez", () => {
    const input = [p("B"), p("A")];
    sortPeopleByName(input, "en");
    expect(input.map((x) => x.displayName)).toEqual(["B", "A"]);
  });

  test("büyük/küçük harf sıralamayı bozmaz", () => {
    const sorted = sortPeopleByName([p("bora"), p("Ali"), p("cem")], "en");
    expect(sorted.map((x) => x.displayName)).toEqual(["Ali", "bora", "cem"]);
  });

  test("adı boşsa kullanıcı adıyla sıralanır", () => {
    const sorted = sortPeopleByName([{ displayName: "", username: "zed" }, p("Mert")], "en");
    expect(sorted.map((x) => x.displayName || x.username)).toEqual(["Mert", "zed"]);
  });

  test("baş harfe göre bölümler; harf olmayanlar '#' ile en sonda", () => {
    const sections = groupPeopleByInitial(
      [p("Ali"), p("123 Kullanıcı"), p("Ayşe"), p("Bora"), p("_gizli")],
      "tr",
    );
    expect(sections.map((s) => s.key)).toEqual(["A", "B", "#"]);
    expect(sections[0].data.map((x) => x.displayName)).toEqual(["Ali", "Ayşe"]);
    expect(sections[2].data).toHaveLength(2);
  });

  test("Türkçe'de 'i' baş harfi 'İ' olur, 'ı' ise 'I'", () => {
    expect(initialOf(p("ilker"), "tr")).toBe("İ");
    expect(initialOf(p("ırmak"), "tr")).toBe("I");
    expect(initialOf(p("ilker"), "en")).toBe("I");
  });

  test("boş liste boş bölüm döner", () => {
    expect(groupPeopleByInitial([], "tr")).toEqual([]);
    expect(groupPeopleByInitial(undefined, "tr")).toEqual([]);
  });
});

describe("totalUnread", () => {
  test("pozitif sayıları toplar, bozuk/negatif değeri yok sayar", () => {
    expect(totalUnread([{ unreadCount: 2 }, { unreadCount: 3 }, { unreadCount: 0 }])).toBe(5);
    expect(totalUnread([{ unreadCount: -4 }, { unreadCount: "x" }, {}, null])).toBe(0);
    expect(totalUnread(undefined)).toBe(0);
  });
});

describe("filterConversations / filterGroups", () => {
  const convs = [
    { id: "1", withName: "Ali", lastText: "Dune izledin mi?" },
    { id: "2", withName: "Ayşe", lastText: "yarın görüşürüz" },
  ];

  test("kişi adına ve son mesaja göre süzer", () => {
    expect(filterConversations(convs, "ay").map((c) => c.id)).toEqual(["2"]);
    expect(filterConversations(convs, "dune").map((c) => c.id)).toEqual(["1"]);
  });

  test("boş sorgu listeyi olduğu gibi döner", () => {
    expect(filterConversations(convs, "")).toBe(convs);
  });

  test("grupları ada göre süzer", () => {
    const groups = [{ id: "g1", name: "Film Gecesi" }, { id: "g2", name: "Dizi Kulübü" }];
    expect(filterGroups(groups, "dizi").map((g) => g.id)).toEqual(["g2"]);
    expect(filterGroups(groups, "")).toBe(groups);
  });
});

describe("toEpochMs", () => {
  test("Timestamp, Date ve sayıyı ms'ye çevirir; gerisi 0", () => {
    expect(toEpochMs({ toMillis: () => 1234 })).toBe(1234);
    expect(toEpochMs(new Date(5000))).toBe(5000);
    expect(toEpochMs(777)).toBe(777);
    expect(toEpochMs(null)).toBe(0);
    expect(toEpochMs({})).toBe(0);
    expect(toEpochMs(NaN)).toBe(0);
  });
});

// Sayaç kullanıcının kendi gelen kutusunda: Users/{uid}/groupInbox/{groupId}
// → { groupId: unread } haritası (groupsService.subscribeGroupInbox).
describe("grup okunmamış sayacı (gelen kutusu)", () => {
  const inbox = { g1: 3, g3: 2, eskiGrup: 9 };

  test("grubun gelen kutusundaki sayacı okur", () => {
    expect(groupUnreadCount(inbox, "g1")).toBe(3);
    expect(groupUnreadCount(inbox, "g2")).toBe(0);
  });

  test("kayıt yoksa, grup kimliği yoksa ya da değer bozuksa 0 döner", () => {
    expect(groupUnreadCount({}, "g1")).toBe(0);
    expect(groupUnreadCount(undefined, "g1")).toBe(0);
    expect(groupUnreadCount(inbox, undefined)).toBe(0);
    expect(groupUnreadCount({ g1: -2 }, "g1")).toBe(0);
    expect(groupUnreadCount({ g1: "x" }, "g1")).toBe(0);
    expect(groupUnreadCount({ g1: 2.9 }, "g1")).toBe(2);
  });

  test("toplam yalnız ÜYESİ OLUNAN grupları sayar (çıkarılınan grubun bayat kaydı girmez)", () => {
    const groups = [{ id: "g1" }, { id: "g3" }, { id: "g5" }];
    expect(totalGroupUnread(groups, inbox)).toBe(5);
    expect(totalGroupUnread(undefined, inbox)).toBe(0);
    expect(totalGroupUnread(groups, undefined)).toBe(0);
  });
});

describe("groupUnreadRecipients", () => {
  test("gönderen DIŞINDAKİ üyeleri döndürür", () => {
    expect(groupUnreadRecipients(["me", "ali", "veli"], "me")).toEqual(["ali", "veli"]);
  });

  test("gönderenden başka üye yoksa boş liste", () => {
    expect(groupUnreadRecipients(["me"], "me")).toEqual([]);
    expect(groupUnreadRecipients([], "me")).toEqual([]);
    expect(groupUnreadRecipients(undefined, "me")).toEqual([]);
  });

  test("boş/bozuk uid atlanır, tekrar eden uid bir kez artırılır (kural tam +1 ister)", () => {
    expect(groupUnreadRecipients(["", null, "ali", "ali"], "me")).toEqual(["ali"]);
  });
});
