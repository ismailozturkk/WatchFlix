import {
  GroupMemberActionTimeoutError,
  waitForGroupMemberAction,
} from "../utils/groupMemberAction";

describe("group member action responsiveness", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("returns a completed member operation and clears its timeout", async () => {
    jest.useFakeTimers();
    const action = jest.fn().mockResolvedValue("done");

    await expect(waitForGroupMemberAction(action, 1000)).resolves.toBe("done");
    expect(action).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test("releases the UI when Firestore acknowledgement remains pending", async () => {
    jest.useFakeTimers();
    const pending = waitForGroupMemberAction(() => new Promise(() => {}), 1000);

    jest.advanceTimersByTime(1000);

    await expect(pending).rejects.toBeInstanceOf(GroupMemberActionTimeoutError);
    expect(jest.getTimerCount()).toBe(0);
  });
});
