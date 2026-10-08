import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { native, impact, notification } = vi.hoisted(() => ({
  native: vi.fn(),
  impact: vi.fn(),
  notification: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: native } }));
vi.mock("@capacitor/haptics", () => ({
  Haptics: { impact, notification },
  ImpactStyle: { Light: "LIGHT" },
  NotificationType: { Success: "SUCCESS", Error: "ERROR" },
}));
import { configureHaptics, feedback } from "./feedback";
beforeEach(() => {
  vi.clearAllMocks();
  configureHaptics(true);
  native.mockReturnValue(true);
  impact.mockResolvedValue(undefined);
  notification.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());
it("honours disabled haptics and the browser platform", async () => {
  configureHaptics(false);
  await feedback("success");
  expect(notification).not.toHaveBeenCalled();
  configureHaptics(true);
  native.mockReturnValue(false);
  await feedback("error");
  expect(notification).not.toHaveBeenCalled();
});
it("uses light taps and distinct outcome feedback", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09"));
  await feedback();
  await feedback();
  expect(impact).toHaveBeenCalledTimes(1);
  expect(impact).toHaveBeenCalledWith({ style: "LIGHT" });
  await feedback("success");
  await feedback("error");
  expect(notification.mock.calls).toEqual([
    [{ type: "SUCCESS" }],
    [{ type: "ERROR" }],
  ]);
});
it("hardware failure never rejects a save flow", async () => {
  notification.mockRejectedValueOnce(new Error("No vibrator"));
  await expect(feedback("success")).resolves.toBeUndefined();
});
