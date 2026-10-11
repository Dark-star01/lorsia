package com.lorsia.launchericon

import android.content.ComponentName
import android.content.pm.PackageManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * يبدّل أيقونة المشغّل بتفعيل activity-alias واحد وتعطيل البقية (PackageManager.setComponentEnabledSetting).
 * الـaliases يولّدها hooks/launcher_icons.py أثناء البناء فقط إن وُجدت ملفات PNG للثيمات؛ وإلا يرجع supported=false.
 * أسماء الـaliases: <packageName>.Icon<Theme> مثل com.lorsia.app.IconNight، والثيم هو نفس المعرّف المحفوظ في الإعدادات.
 * من JavaScript:
 *   await Capacitor.Plugins.LorsiaLauncherIcon.setIcon({ theme: 'night' })   // -> { supported, theme }
 *   await Capacitor.Plugins.LorsiaLauncherIcon.getIcon()                     // -> { supported, theme }
 */
@CapacitorPlugin(name = "LorsiaLauncherIcon")
class LorsiaLauncherIcon : Plugin() {

    private val themes = listOf("modern", "library", "snow", "night")
    // الـalias الذي يُفعَّل افتراضياً في المانيفست المولَّد (يطابق الثيم الافتراضي للتطبيق)
    private val manifestDefault = "modern"

    private fun component(theme: String): ComponentName {
        val cls = theme.replaceFirstChar { it.uppercase() }
        return ComponentName(context.packageName, context.packageName + ".Icon" + cls)
    }

    private fun exists(theme: String): Boolean = try {
        context.packageManager.getActivityInfo(component(theme), PackageManager.MATCH_DISABLED_COMPONENTS)
        true
    } catch (e: PackageManager.NameNotFoundException) {
        false
    }

    private fun isEnabled(theme: String): Boolean {
        return when (context.packageManager.getComponentEnabledSetting(component(theme))) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
            PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> theme == manifestDefault
            else -> false
        }
    }

    @PluginMethod
    fun setIcon(call: PluginCall) {
        val theme = call.getString("theme")
        if (theme == null || !themes.contains(theme)) {
            call.reject("ثيم غير معروف")
            return
        }
        val present = themes.filter { exists(it) }
        val ret = JSObject()
        if (!present.contains(theme)) {
            ret.put("supported", false)
            call.resolve(ret)
            return
        }
        try {
            val pm = context.packageManager
            // نفعّل الجديد أولاً ثم نعطّل البقية؛ DONT_KILL_APP يمنع إغلاق التطبيق
            pm.setComponentEnabledSetting(component(theme), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
            for (t in present) {
                if (t != theme) {
                    pm.setComponentEnabledSetting(component(t), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
                }
            }
            ret.put("supported", true)
            ret.put("theme", theme)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("تعذّر تبديل الأيقونة: " + (e.message ?: ""))
        }
    }

    @PluginMethod
    fun getIcon(call: PluginCall) {
        val present = themes.filter { exists(it) }
        val ret = JSObject()
        ret.put("supported", present.isNotEmpty())
        val cur = present.firstOrNull { isEnabled(it) }
        if (cur != null) ret.put("theme", cur)
        call.resolve(ret)
    }
}
