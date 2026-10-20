/**
 * Seelogd — iOS "Yaklaşanlar" widget hedefi (@bacons/apple-targets).
 *
 * `npx expo prebuild -p ios` çalıştığında bu dizindeki tüm .swift dosyaları
 * bir WidgetKit uzantısı hedefi olarak Xcode projesine eklenir. Widget, App
 * Group üzerinden ana uygulamanın yazdığı hatırlatıcı verisini okur.
 *
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
  type: "widget",
  name: "ReminderWidget",
  deploymentTarget: "15.1",
  frameworks: ["SwiftUI", "WidgetKit"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.smlztrk.seelogd"],
  },
};
