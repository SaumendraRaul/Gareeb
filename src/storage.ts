import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { validateState, type State } from "./model";
const KEY = "gareeb.v1";
export async function loadState(): Promise<State | null> {
  const { value } = await Preferences.get({ key: KEY });
  return value ? validateState(JSON.parse(value)) : null;
}
let queue = Promise.resolve();
export function persist(s: State) {
  const value = JSON.stringify(s);
  queue = queue
    .catch(() => {})
    .then(() => Preferences.set({ key: KEY, value }));
  return queue;
}
export async function download(
  name: string,
  content: string,
  type = "application/json",
) {
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: name,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: name, url: result.uri });
  } else {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
