import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint, isValidPushKeys } from "./push-endpoint";

describe("push абонамент", () => {
  it("приема push услугите на браузърите", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc:APA91b")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/gAAAA")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-db5p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QGuQyavXutnMH")).toBe(true);
  });

  it("отхвърля всичко друго — вътрешни адреси, чужди хостове, порт, http", () => {
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/x",
      "https://fcm.googleapis.com:8443/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost:3000/api/admin/backup",
      "https://evil.com/fcm.googleapis.com",
      "https://fcm.googleapis.com.evil.com/x",
      "https://user:pass@fcm.googleapis.com/x",
      "не е адрес",
    ]) {
      expect(isAllowedPushEndpoint(bad)).toBe(false);
    }
  });

  it("ключовете са base64url", () => {
    expect(isValidPushKeys({ p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" })).toBe(true);
    expect(isValidPushKeys({ p256dh: "<script>", auth: "x" })).toBe(false);
    expect(isValidPushKeys(null)).toBe(false);
  });
});
