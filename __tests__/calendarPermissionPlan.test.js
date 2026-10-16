// Ayarlar > İzinlerim > Takvim sayfasının görünüm planı (saf karar fonksiyonu).
import { planCalendarPermissionSheet as plan } from "../utils/calendarPermissionPlan";

describe("planCalendarPermissionSheet", () => {
  it("izin yok + sorulabilir: ana eylem izin istemek, geri çek yok", () => {
    const p = plan({ status: "undetermined", canAskAgain: true, savedCount: 0 });
    expect(p.primaryAction).toBe("request");
    expect(p.showRevoke).toBe(false);
    expect(p.showDeniedHint).toBe(false);
    expect(p.canRemove).toBe(false);
  });

  it("kalıcı reddedilmiş: sistem ayarlarına yönlendirir ve nedenini söyler", () => {
    const p = plan({ status: "denied", canAskAgain: false, savedCount: 0 });
    expect(p.primaryAction).toBe("openSettings");
    expect(p.showDeniedHint).toBe(true);
  });

  it("izin açık + etkinlik var: kaldırma ve geri çek, kapatmadan önce temizleme önerisi", () => {
    const p = plan({ status: "granted", canAskAgain: true, savedCount: 4 });
    expect(p.primaryAction).toBeNull();
    expect(p.canRemove).toBe(true);
    expect(p.showCount).toBe(true);
    expect(p.showRevoke).toBe(true);
    expect(p.showRevokeAdvice).toBe(true);
    expect(p.count).toBe(4);
  });

  it("izin açık + etkinlik yok: kaldırılacak bir şey yok, öneri de yok", () => {
    const p = plan({ status: "granted", canAskAgain: true, savedCount: 0 });
    expect(p.showEmpty).toBe(true);
    expect(p.canRemove).toBe(false);
    expect(p.showRevokeAdvice).toBe(false);
    expect(p.showRevoke).toBe(true);
  });

  it("izin kapalı ama telefonda Seelogd etkinliği duruyor: kaldırılamayacağı uyarılır", () => {
    const p = plan({ status: "denied", canAskAgain: true, savedCount: 3 });
    expect(p.showOrphanWarning).toBe(true);
    expect(p.canRemove).toBe(false); // izin yokken silme düğmesi çalışmazdı
  });

  it("bozuk sayaç girdisi 0 sayılır", () => {
    expect(plan({ status: "granted", savedCount: NaN }).count).toBe(0);
    expect(plan({ status: "granted", savedCount: -2 }).count).toBe(0);
    expect(plan({ status: "granted", savedCount: undefined }).count).toBe(0);
    expect(plan().granted).toBe(false);
  });
});
