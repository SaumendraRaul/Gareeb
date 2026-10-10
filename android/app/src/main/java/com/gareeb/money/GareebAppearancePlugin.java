package com.gareeb.money;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Paint native inset areas too: older WebViews render outside the system bars. */
@CapacitorPlugin(name = "GareebAppearance")
public class GareebAppearancePlugin extends Plugin {
    private boolean dark;

    @Override public void load() {
        dark = getContext().getSharedPreferences("gareeb_appearance", Context.MODE_PRIVATE)
            .getBoolean("dark", false);
        refresh();
    }

    @PluginMethod public void setTheme(PluginCall call) {
        boolean next = Boolean.TRUE.equals(call.getBoolean("dark", false));
        getActivity().runOnUiThread(() -> {
            dark = next;
            getContext().getSharedPreferences("gareeb_appearance", Context.MODE_PRIVATE)
                .edit().putBoolean("dark", dark).apply();
            apply();
            call.resolve();
        });
    }

    @Override protected void handleOnResume() { refresh(); }
    @Override protected void handleOnConfigurationChanged(Configuration config) { refresh(); }

    private void refresh() {
        // Run after Capacitor's system-bar configuration callbacks.
        getActivity().getWindow().getDecorView().post(this::apply);
    }

    @SuppressWarnings("deprecation")
    private void apply() {
        Window window = getActivity().getWindow();
        int color = Color.parseColor(dark ? "#151e19" : "#f7f8f2");
        window.setBackgroundDrawable(new ColorDrawable(color));
        window.getDecorView().setBackgroundColor(color);
        // Pre-edge-to-edge devices still use these colors. On Android 15+,
        // transparent system bars reveal the matching decor/WebView surface.
        window.setStatusBarColor(color);
        window.setNavigationBarColor(color);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(!dark);
        controller.setAppearanceLightNavigationBars(!dark);
    }
}
