import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { day, nextDue, type State } from "./model";

export function upcomingReminders(s: State, now = new Date()) {
  const notifications = [];
  for (const b of s.bills.filter((b) => b.active)) {
    if (b.trialEnd && b.trialEnd >= day(now)) {
      const trialAt = new Date(b.trialEnd + "T09:00:00");
      if (trialAt <= now) trialAt.setTime(now.getTime() + 60000);
      notifications.push({
        id: 100000 + notifications.length,
        title: "A little reminder from Gareeb",
        body: "A free trial is ending. Open Gareeb to review it.",
        schedule: { at: trialAt },
        isExactNotification: false,
        channelId: "gareeb-bills",
        extra: { billId: b.id },
        autoCancel: true,
      });
    }
    let date = b.remindOn || b.date;
    for (let i = 0; i < 6000 && date < day(now); i++)
      date = nextDue(date, b.cadence, b.anchorDay || Number(b.date.slice(8)));
    const at = new Date(date + "T09:00:00");
    if (at <= now) {
      if (date === day(now)) at.setTime(now.getTime() + 60000);
      else continue;
    }
    notifications.push({
      id: 100000 + notifications.length,
      title: "A little reminder from Gareeb",
      body: "A planned bill is due. Open Gareeb to review it.",
      schedule: { at },
      isExactNotification: false,
      channelId: "gareeb-bills",
      extra: { billId: b.id },
      autoCancel: true,
    });
  }
  return notifications
    .sort((a, b) => a.schedule.at.getTime() - b.schedule.at.getTime())
    .slice(0, 64);
}
let queue: Promise<unknown> = Promise.resolve();
export function syncReminders(s: State) {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(0);
  const task = queue
    .catch(() => {})
    .then(async () => {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length)
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
      if (!s.settings.reminders || s.demo) return 0;
      if ((await LocalNotifications.checkPermissions()).display !== "granted")
        throw Error("Notifications are disabled in Android settings.");
      await LocalNotifications.createChannel({
        id: "gareeb-bills",
        name: "Bill reminders",
        description: "Private reminders for your planned bills",
        importance: 3,
        visibility: -1,
      });
      const notifications = upcomingReminders(s);
      if (notifications.length)
        await LocalNotifications.schedule({ notifications });
      return notifications.length;
    });
  queue = task;
  return task;
}
export async function requestReminders() {
  if (!Capacitor.isNativePlatform())
    throw Error("Device reminders are available in the Android app.");
  if ((await LocalNotifications.requestPermissions()).display !== "granted")
    throw Error(
      "Allow notifications in Android settings to receive reminders.",
    );
}
