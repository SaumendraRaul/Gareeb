import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.gareeb.money",
  appName: "Gareeb",
  webDir: "dist",
  plugins: {
    SystemBars: {
      style: "LIGHT",
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
  },
  android: { backgroundColor: "#f7f8f2" },
};
export default config;
