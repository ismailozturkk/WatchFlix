import { Keys, get, set, clearUserScope } from "../services/storage";

describe("Auth initial route logic", () => {
  beforeEach(() => {
    set(Keys.hasSeenOnboarding, false);
  });

  it("ilk açılışta (hasSeenOnboarding: false) OnboardingScreen seçilir", () => {
    const seenOnboarding = get(Keys.hasSeenOnboarding);
    const initialRoute = seenOnboarding ? "LoginScreen" : "OnboardingScreen";
    expect(initialRoute).toBe("OnboardingScreen");
  });

  it("onboarding görüldükten sonra (hasSeenOnboarding: true) LoginScreen seçilir", () => {
    set(Keys.hasSeenOnboarding, true);
    const seenOnboarding = get(Keys.hasSeenOnboarding);
    const initialRoute = seenOnboarding ? "LoginScreen" : "OnboardingScreen";
    expect(initialRoute).toBe("LoginScreen");
  });

  it("çıkış yapıldığında hasSeenOnboarding silinmez ve sonraki açılışta LoginScreen kalır", () => {
    set(Keys.hasSeenOnboarding, true);
    clearUserScope("user-1");

    const seenOnboarding = get(Keys.hasSeenOnboarding);
    const initialRoute = seenOnboarding ? "LoginScreen" : "OnboardingScreen";
    expect(initialRoute).toBe("LoginScreen");
  });
});
