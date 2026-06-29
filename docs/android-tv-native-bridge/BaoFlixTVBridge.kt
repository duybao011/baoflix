package your.package.name

import android.app.Activity
import android.view.KeyEvent
import android.webkit.JavascriptInterface
import android.webkit.WebView

/**
 * Mẫu native bridge cho APK Android TV shell của BảoFlix.
 * File này KHÔNG tự dùng trong Next.js. Copy logic này sang Activity/WebView của APK TV.
 */
class BaoFlixTVBridge(
    private val activity: Activity,
    private val webView: WebView
) {
    @JavascriptInterface
    fun sendCommand(command: String) {
        activity.runOnUiThread {
            when (command) {
                "focus-player" -> focusPlayer()
                "seek-backward" -> seek(false)
                "seek-forward" -> seek(true)
                "toggle-play" -> sendKey(KeyEvent.KEYCODE_DPAD_CENTER)
            }
        }
    }

    private fun focusPlayer() {
        webView.requestFocus()
        webView.evaluateJavascript(
            "window.__baoflixFocusWebPlayer && window.__baoflixFocusWebPlayer();",
            null
        )
    }

    private fun seek(forward: Boolean) {
        focusPlayer()

        webView.postDelayed({
            sendKey(if (forward) KeyEvent.KEYCODE_DPAD_RIGHT else KeyEvent.KEYCODE_DPAD_LEFT)
        }, 140)
    }

    private fun sendKey(keyCode: Int) {
        webView.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, keyCode))
        webView.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, keyCode))
    }
}
