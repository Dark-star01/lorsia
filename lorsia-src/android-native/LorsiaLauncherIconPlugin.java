// NOT BUILT OR TESTED: the uploaded project contains no Android/Capacitor project, so this file was written
// against the documented Capacitor 5/6 plugin API and the Android PackageManager API, but never compiled.
// Copy to android/app/src/main/java/<your/java/package>/ and fix the `package` line to your real Java package.
package com.example.lorsia; // TODO: replace with the Java package of your MainActivity (the manifest "namespace")

import android.content.ComponentName;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS side: js/launcher-icon.js calls LorsiaLauncherIcon.setIcon({ theme }) when the app goes to the background. */
@CapacitorPlugin(name = "LorsiaLauncherIcon")
public class LorsiaLauncherIconPlugin extends Plugin {

    // theme id (same ids as U.THEMES / prefs.theme)  ->  <activity-alias> class name declared in the manifest
    private static final String[][] ALIASES = {
        {"modern",  ".LauncherModern"},   // Light / Day  (default, enabled in the manifest)
        {"library", ".LauncherLibrary"},
        {"snow",    ".LauncherSnow"},
        {"night",   ".LauncherNight"}     // Dark / Night
    };

    @PluginMethod
    public void setIcon(PluginCall call) {
        String theme = call.getString("theme");
        String wanted = null;
        for (String[] a : ALIASES) if (a[0].equals(theme)) wanted = a[1];
        if (wanted == null) { call.reject("Unknown theme: " + theme); return; }

        PackageManager pm = getContext().getPackageManager();
        String pkg = getContext().getPackageName(); // applicationId (unchanged)
        String ns = getActivity().getClass().getPackage().getName(); // manifest namespace = Java package of MainActivity
        try {
            ComponentName target = new ComponentName(pkg, ns + wanted);
            // 1) enable the new alias first so there is never a moment with no launcher entry
            if (pm.getComponentEnabledSetting(target) != PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                pm.setComponentEnabledSetting(target, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
            }
            // 2) then disable every other alias
            for (String[] a : ALIASES) {
                if (a[1].equals(wanted)) continue;
                ComponentName other = new ComponentName(pkg, ns + a[1]);
                if (pm.getComponentEnabledSetting(other) != PackageManager.COMPONENT_ENABLED_STATE_DISABLED) {
                    pm.setComponentEnabledSetting(other, PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
                }
            }
            JSObject r = new JSObject(); r.put("supported", true); r.put("theme", theme);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not switch launcher icon: " + e.getMessage(), e);
        }
    }
}
