import sharp from "sharp";
import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
const svg = await readFile("public/icon.svg");
for (const [density, size] of Object.entries({
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
})) {
  const dir = `android/app/src/main/res/mipmap-${density}`;
  await mkdir(dir, { recursive: true });
  for (const name of ["ic_launcher", "ic_launcher_round"])
    await sharp(svg).resize(size, size).png().toFile(`${dir}/${name}.png`);
  const fg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><path d="M64 39a18 18 0 1 0 6 28V54H54" fill="none" stroke="#d6ed9c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="70" cy="36" r="4" fill="#d6ed9c"/></svg>',
  );
  await sharp(fg)
    .resize(Math.round(size * 2.25))
    .png()
    .toFile(`${dir}/ic_launcher_foreground.png`);
}
const adaptive =
  '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>';
await mkdir("android/app/src/main/res/mipmap-anydpi-v26", { recursive: true });
for (const name of ["ic_launcher", "ic_launcher_round"])
  await writeFile(
    `android/app/src/main/res/mipmap-anydpi-v26/${name}.xml`,
    adaptive,
  );
await writeFile(
  "android/app/src/main/res/values/ic_launcher_background.xml",
  '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#194d3d</color></resources>',
);
console.log("Gareeb Android launcher icons generated.");
for (const dir of await readdir("android/app/src/main/res")) {
  if (!dir.startsWith("drawable")) continue;
  const path = `android/app/src/main/res/${dir}/splash.png`;
  try {
    const { width, height } = await sharp(path).metadata();
    const size = Math.round(Math.min(width, height) * 0.2);
    const mark = await sharp(svg).resize(size, size).toBuffer();
    const splash = await sharp({
      create: { width, height, channels: 4, background: "#f7f8f2" },
    })
      .composite([{ input: mark, gravity: "centre" }])
      .png()
      .toBuffer();
    await writeFile(path, splash);
  } catch (e) {
    if (e.message.includes("Input file is missing")) continue;
    throw e;
  }
}
