// ErrorBoundary sağlayıcıların DIŞINDA durur (App.js). Yedek ekranı tema/dil gibi bir
// bağlama dokunursa, asıl hatayı gizleyen ikinci bir çökme olur
// ("useTheme must be used within a ThemeProvider"). Burada yedek ekran, HİÇBİR
// sağlayıcı olmadan çizilir.

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  StyleSheet: { create: (s) => s },
}));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../utils/i18nText", () => ({ i18nText: (_k, fallback) => fallback }));
jest.mock("../services/crashReporting", () => ({ captureError: jest.fn() }));

const fs = require("fs");
const path = require("path");
const React = require("react");
const { create, act } = require("react-test-renderer");
const ErrorBoundary = require("../components/ErrorBoundary").default;

global.IS_REACT_ACT_ENVIRONMENT = true;

function Boom() {
  throw new Error("asıl hata");
}

describe("ErrorBoundary", () => {
  let spy;
  beforeEach(() => {
    spy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("sağlayıcı olmadan yedek ekranı çizer ve 'Tekrar Dene' ile toparlanır", () => {
    let flaky = true;
    function Maybe() {
      if (flaky) throw new Error("asıl hata");
      return React.createElement("Text", null, "iyi");
    }
    let renderer;
    act(() => {
      renderer = create(React.createElement(ErrorBoundary, null, React.createElement(Maybe)));
    });
    const button = renderer.root.findByType("TouchableOpacity");
    flaky = false;
    act(() => button.props.onPress());
    expect(renderer.root.findAllByType("TouchableOpacity")).toHaveLength(0);
  });

  it("yedek ekranda Tekrar Dene düğmesi vardır", () => {
    let renderer;
    act(() => {
      renderer = create(React.createElement(ErrorBoundary, null, React.createElement(Boom)));
    });
    expect(renderer.root.findByType("TouchableOpacity").props.accessibilityRole).toBe("button");
  });

  it("kaynak dosya tema/dil/cam bileşenlerini içe aktarmaz", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "components", "ErrorBoundary.js"), "utf8");
    expect(source).not.toMatch(/from\s+["'][^"']*(context\/|Glass|useTheme|ThemeContext)/);
  });
});
