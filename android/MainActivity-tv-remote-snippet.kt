// Dán logic này vào MainActivity của APK TV nếu sau khi patch web mà TCL vẫn không ăn phím.
// Mục tiêu: lấy KeyEvent native của Google TV/TCL rồi bơm vào web qua CustomEvent.

import android.app.Activity
import android.os.Bundle
import android.view.KeyEvent
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient = WebViewClient()

        // Rất quan trọng với Google TV/TCL remote.
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        webView.requestFocus()
        webView.requestFocusFromTouch()

        webView.loadUrl("https://baoflix.vercel.app/tv")
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN && isTvRemoteKey(event.keyCode)) {
            sendTvKeyToWeb(event.keyCode)
            return true
        }

        return super.dispatchKeyEvent(event)
    }

    private fun isTvRemoteKey(keyCode: Int): Boolean {
        return keyCode == KeyEvent.KEYCODE_BACK ||
            keyCode == KeyEvent.KEYCODE_DPAD_UP ||
            keyCode == KeyEvent.KEYCODE_DPAD_DOWN ||
            keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
            keyCode == KeyEvent.KEYCODE_DPAD_RIGHT ||
            keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            keyCode == KeyEvent.KEYCODE_ENTER ||
            keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE ||
            keyCode == KeyEvent.KEYCODE_MEDIA_REWIND ||
            keyCode == KeyEvent.KEYCODE_MEDIA_FAST_FORWARD ||
            keyCode == KeyEvent.KEYCODE_MEDIA_PLAY ||
            keyCode == KeyEvent.KEYCODE_MEDIA_PAUSE
    }

    private fun sendTvKeyToWeb(keyCode: Int) {
        val js = """
            window.dispatchEvent(new CustomEvent('baoflix-tv-remote-key', {
              detail: { keyCode: $keyCode }
            }));
        """.trimIndent()

        webView.evaluateJavascript(js, null)
    }
}
