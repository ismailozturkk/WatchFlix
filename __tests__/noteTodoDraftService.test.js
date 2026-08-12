import { __resetAllMMKV } from "react-native-mmkv";
import { __resetStores } from "../services/storage/instances";
import { __resetStoreCaches } from "../services/storage/store";
import { setActiveUser } from "../services/storage";
import {
  getNoteTodoDraft,
  removeNoteTodoDraft,
  saveNoteTodoDraft,
  todoDraftKey,
} from "../services/noteTodoDraftService";

beforeEach(() => {
  __resetStores();
  __resetAllMMKV();
  __resetStoreCaches();
  setActiveUser("user-1");
});

describe("note todo drafts", () => {
  test("stores new and existing todo drafts separately", () => {
    saveNoteTodoDraft(todoDraftKey(), { todos: [{ id: "a", done: false }] });
    saveNoteTodoDraft(todoDraftKey("42"), { todos: [{ id: "b", done: true }] });

    expect(getNoteTodoDraft("new").todos[0].id).toBe("a");
    expect(getNoteTodoDraft("note:42").todos[0]).toMatchObject({ id: "b", done: true });
  });

  test("keeps drafts user-scoped and removes only the requested draft", () => {
    saveNoteTodoDraft("note:42", { title: "Bir" });
    saveNoteTodoDraft("note:99", { title: "İki" });
    setActiveUser("user-2");
    expect(getNoteTodoDraft("note:42")).toBeNull();

    setActiveUser("user-1");
    expect(removeNoteTodoDraft("note:42")).toBe(true);
    expect(getNoteTodoDraft("note:42")).toBeNull();
    expect(getNoteTodoDraft("note:99").title).toBe("İki");
  });
});
