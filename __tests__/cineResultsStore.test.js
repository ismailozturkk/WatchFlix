jest.mock("../services/storage", () => ({
  Keys: { cineLastResult: {} }, get: jest.fn(), set: jest.fn(),
}));
jest.mock("../services/cineswipe/cineswipeService", () => ({ acknowledgeCineResults: jest.fn() }));
const { get, set } = require("../services/storage");
const { acknowledgeCineResults } = require("../services/cineswipe/cineswipeService");
const { persistCineResults } = require("../services/cineswipe/cineResultsStore");
const result = { roomId: "room", summary: { complete: true } };

beforeEach(() => {
  jest.resetAllMocks();
  set.mockReturnValue(true);
  get.mockReturnValue(result);
  acknowledgeCineResults.mockResolvedValue(undefined);
});

test("local storage succeeds before delivery acknowledgement", async () => {
  acknowledgeCineResults.mockImplementation(async () => {
    expect(set).toHaveBeenCalledWith(expect.anything(), { ...result, receiptPending: true }, { uid: "host" });
  });
  await expect(persistCineResults(result, "host")).resolves.toMatchObject({ receiptPending: false });
});

test("local write failure never authorizes room deletion", async () => {
  set.mockReturnValue(false);
  await expect(persistCineResults(result, "host")).rejects.toThrow("local-save-failed");
  expect(acknowledgeCineResults).not.toHaveBeenCalled();
});

test("offline acknowledgement leaves a saved pending receipt for retry", async () => {
  acknowledgeCineResults.mockRejectedValue({ code: "unavailable" });
  await expect(persistCineResults(result, "host")).rejects.toMatchObject({ code: "unavailable" });
  expect(set).toHaveBeenCalledTimes(1);
  expect(set.mock.calls[0][1].receiptPending).toBe(true);
});

test("late receipt cannot overwrite a newer result", async () => {
  get.mockReturnValue({ roomId: "new-room" });
  await persistCineResults(result, "host");
  expect(set).toHaveBeenCalledTimes(1);
});

test("incomplete result never gets a receipt", async () => {
  await expect(persistCineResults({ ...result, summary: { complete: false } }, "host")).rejects.toThrow("invalid-result");
  expect(set).not.toHaveBeenCalled();
  expect(acknowledgeCineResults).not.toHaveBeenCalled();
});
