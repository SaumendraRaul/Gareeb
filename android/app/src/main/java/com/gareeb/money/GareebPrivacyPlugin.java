package com.gareeb.money;

import android.app.KeyguardManager;
import android.content.Context;
import android.view.WindowManager;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GareebPrivacy")
public class GareebPrivacyPlugin extends Plugin {
    private boolean prompting = false;
    private boolean enabled() { return getContext().getSharedPreferences("gareeb_security", Context.MODE_PRIVATE).getBoolean("enabled", false); }
    private boolean available() {
        KeyguardManager manager = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        return manager != null && manager.isDeviceSecure();
    }
    private void protect(boolean enabled) {
        if (enabled) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }
    @PluginMethod public void status(PluginCall call) {
        getActivity().runOnUiThread(() -> protect(enabled()));
        JSObject result = new JSObject(); result.put("enabled", enabled()); result.put("available", available()); call.resolve(result);
    }
    @PluginMethod public void authenticate(PluginCall call) { authenticate(call, null); }
    @PluginMethod public void setEnabled(PluginCall call) {
        Boolean target = call.getBoolean("enabled");
        if (target == null) { call.reject("Choose an app-lock setting."); return; }
        authenticate(call, target);
    }
    private void authenticate(PluginCall call, Boolean target) {
        if (!available()) { call.reject("Set up a device screen lock in Android settings first."); return; }
        getActivity().runOnUiThread(() -> {
            if (prompting) { call.reject("An unlock prompt is already open."); return; }
            prompting = true;
            try {
                BiometricPrompt prompt = new BiometricPrompt((FragmentActivity) getActivity(), ContextCompat.getMainExecutor(getContext()), new BiometricPrompt.AuthenticationCallback() {
                    @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        prompting = false;
                        if (target != null) {
                            getContext().getSharedPreferences("gareeb_security", Context.MODE_PRIVATE).edit().putBoolean("enabled", target).apply();
                            protect(target);
                        }
                        call.resolve();
                    }
                    @Override public void onAuthenticationError(int code, CharSequence message) { prompting = false; call.reject(message.toString()); }
                });
                BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Your Gareeb, just for you")
                    .setSubtitle(target == null ? "Unlock your money space" : target ? "Confirm to enable app lock" : "Confirm to disable app lock")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                    .build();
                prompt.authenticate(info);
            } catch (Exception e) { prompting = false; call.reject("Device authentication is unavailable. Check your screen-lock settings."); }
        });
    }
}
