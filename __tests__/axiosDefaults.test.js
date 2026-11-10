// Global axios zaman aşımı bekçisi (yayın denetimi 9 Kas, N-1).
import axios from "axios";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  installAxiosDefaults,
} from "../utils/axiosDefaults";

describe("installAxiosDefaults", () => {
  it("süre vermeyen isteklere sonlu bir tavan koyar", () => {
    installAxiosDefaults();
    expect(axios.defaults.timeout).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(8000);
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(30000);
  });

  it("App.js açılışta kurar", () => {
    // eslint-disable-next-line global-require
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "..", "App.js"),
      "utf8",
    );
    expect(source).toMatch(/^installAxiosDefaults\(\);$/m);
  });
});
