import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

let enabled = true;
let lastTap = -Infinity;
export function configureHaptics(value: boolean) {
  enabled = value;
}
export async function feedback(kind: "tap" | "success" | "error" = "tap") {
  if (!enabled || !Capacitor.isNativePlatform()) return;
  if (kind === "tap" && Date.now() - lastTap < 65) return;
  if (kind === "tap") lastTap = Date.now();
  try {
    if (kind === "tap") await Haptics.impact({ style: ImpactStyle.Light });
    else
      await Haptics.notification({
        type:
          kind === "success"
            ? NotificationType.Success
            : NotificationType.Error,
      });
  } catch {
    /* Feedback must never interrupt a financial action. */
  }
}
