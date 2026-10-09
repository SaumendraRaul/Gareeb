import sharp from "sharp";
import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";

// One set of curves drives the interface, vector exports, and Android artwork.
const brand = JSON.parse(await readFile("src/brand.json", "utf8"));
const colors = { pocket: "#f1efd8", fold: "#91aa86", coin: "#e4ba70", glint: "#fff0c5" };
const paths = (palette) => brand.paths.map(({ role, d }) => `<path fill="${palette[role]}" d="${d}"/>`).join("");
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${brand.viewBox}">${body}</svg>`;
const defs = `<defs><linearGradient id="forest" x2="1" y2="1"><stop stop-color="#2b604c"/><stop offset="1" stop-color="#10392e"/></linearGradient><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f6db9f"/><stop offset="1" stop-color="#c79749"/></linearGradient><linearGradient id="silk" x2="0.4" y2="1"><stop stop-color="#fffbe8"/><stop offset="1" stop-color="#d9dec2"/></linearGradient></defs>`;
const artwork = paths({ ...colors, pocket: "url(#silk)", coin: "url(#gold)" });
const background = `<rect width="128" height="128" rx="30" fill="url(#forest)"/><rect x="1" y="1" width="126" height="126" rx="29" fill="none" stroke="#ffffff" stroke-opacity="0.12"/>`;
const icon = Buffer.from(svg(defs + background + artwork));
await mkdir("public/brand", { recursive: true });
await writeFile("public/icon.svg", icon);
await writeFile("public/brand/mark.svg", svg(paths({ ...colors, pocket: "#245b45", coin: "#c49b50" })));
await writeFile("public/brand/mark-light.svg", svg(paths(colors)));
await writeFile("public/brand/mark-monochrome.svg", svg(paths(Object.fromEntries(Object.keys(colors).map(k => [k, "#245b45"])))));
await sharp(icon).resize(1024).png().toFile("public/brand/app-icon.png");

const res = "android/app/src/main/res";
// Keep the complete mark within the Android adaptive icon safe circle.
const foreground = Buffer.from(svg(defs + `<g transform="translate(16 16) scale(.75)">${artwork}</g>`));
for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  const dir = `${res}/mipmap-${density}`;
  await mkdir(dir, { recursive: true });
  await sharp(icon).resize(size).png().toFile(`${dir}/ic_launcher.png`);
  const round = Buffer.from(svg(defs + `<circle cx="64" cy="64" r="64" fill="url(#forest)"/>` + artwork));
  await sharp(round).resize(size).png().toFile(`${dir}/ic_launcher_round.png`);
  await sharp(foreground).resize(Math.round(size * 2.25)).png().toFile(`${dir}/ic_launcher_foreground.png`);
}
const vectorPaths = (palette) => brand.paths.map(({ role, d }) => `<path android:fillColor="${palette[role]}" android:pathData="${d}"/>`).join("");
const vector = (body) => `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="128" android:viewportHeight="128">${body}</vector>`;
const safe = (body) => `<group android:pivotX="64" android:pivotY="64" android:scaleX="0.75" android:scaleY="0.75">${body}</group>`;
await writeFile(`${res}/drawable/ic_launcher_monochrome.xml`, vector(safe(vectorPaths(Object.fromEntries(Object.keys(colors).map(k => [k, "#ffffff"]))))));
await writeFile(`${res}/drawable/splash_icon.xml`, vector(safe(vectorPaths({ ...colors, pocket: "#245b45", coin: "#c49b50" }))));
for (const api of [26, 33]) {
  const dir = `${res}/mipmap-anydpi-v${api}`;
  await mkdir(dir, { recursive: true });
  const adaptive = `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/>${api >= 33 ? '<monochrome android:drawable="@drawable/ic_launcher_monochrome"/>' : ''}</adaptive-icon>`;
  for (const name of ["ic_launcher", "ic_launcher_round"]) await writeFile(`${dir}/${name}.xml`, adaptive);
}
await writeFile(`${res}/values/ic_launcher_background.xml`, '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#194d3d</color></resources>');
for (const dir of await readdir(res)) {
  if (!dir.startsWith("drawable")) continue;
  const path = `${res}/${dir}/splash.png`;
  try {
    const { width, height } = await sharp(path).metadata();
    const size = Math.round(Math.min(width, height) * 0.2);
    const mark = await sharp("public/brand/mark.svg").resize(size, size).toBuffer();
    const splash = await sharp({ create: { width, height, channels: 4, background: "#f7f8f2" } }).composite([{ input: mark, gravity: "centre" }]).png().toBuffer();
    await writeFile(path, splash);
  } catch (e) {
    if (e.message.includes("Input file is missing")) continue;
    throw e;
  }
}
console.log("Generated Gareeb pocket identity, Android adaptive/themed icons, and launch screens.");
