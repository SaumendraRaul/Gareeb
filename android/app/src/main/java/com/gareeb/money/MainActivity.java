package com.gareeb.money;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.Context;
import android.view.WindowManager;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GareebPrivacyPlugin.class);
        registerPlugin(GareebAppearancePlugin.class);
        if (getSharedPreferences("gareeb_security", Context.MODE_PRIVATE).getBoolean("enabled", false)) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
        super.onCreate(savedInstanceState);
    }
}
