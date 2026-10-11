package com.lorsia.filesaver

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.util.Base64
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * يحفظ ملفاً اختاره المستخدم عبر نافذة النظام (Storage Access Framework).
 * لا يحتاج أي صلاحية تخزين. من JavaScript:
 *   await Capacitor.Plugins.LorsiaFileSaver.save({ filename, mime, data })  // data نص base64
 */
@CapacitorPlugin(name = "LorsiaFileSaver")
class LorsiaFileSaver : Plugin() {

    @PluginMethod
    fun save(call: PluginCall) {
        val filename = call.getString("filename")
        val data = call.getString("data")
        if (filename.isNullOrEmpty() || data == null) {
            call.reject("بيانات الملف ناقصة")
            return
        }
        val mime = (call.getString("mime") ?: "application/octet-stream").substringBefore(";")
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
        intent.addCategory(Intent.CATEGORY_OPENABLE)
        intent.type = mime
        intent.putExtra(Intent.EXTRA_TITLE, filename)
        startActivityForResult(call, intent, "onSaved")
    }

    @ActivityCallback
    private fun onSaved(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("cancelled")
            return
        }
        val uri: Uri? = result.data?.data
        val data = call.getString("data")
        if (uri == null || data == null) {
            call.reject("تعذّر تحديد مكان الحفظ")
            return
        }
        try {
            val bytes = Base64.decode(data, Base64.DEFAULT)
            val out = context.contentResolver.openOutputStream(uri, "wt")
            if (out == null) {
                call.reject("تعذّر فتح الملف للكتابة")
                return
            }
            out.use { it.write(bytes) }
            val ret = JSObject()
            ret.put("uri", uri.toString())
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("تعذّر كتابة الملف: " + (e.message ?: ""))
        }
    }
}
