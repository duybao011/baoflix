// MainActivity hard fix cho APK WebView BảoFlix TV.
// Dùng nếu đã deploy web mà TCL vẫn không bắt remote.
// Quan trọng: đoạn này gửi custom event mà TvRemoteKeyBridge trên web đang nghe.

import android.annotation.SuppressLint
import android.view.KeyEvent
import android.webkit.WebView

private fun WebView.prepareBaoflixTvWebView() {
    isFocusable = true
    isFocusableInTouchMode = true
    requestFocus()

    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.mediaPlaybackRequiresUserGesture = false

    val oldUa = settings.userAgentString ?: ""
    if (!oldUa.contains("BaoFlixTV", ignoreCase = true)) {
        settings.userAgentString = "$oldUa BaoFlixTV"
    }
}

private fun isBaoflixTvRemoteKey(keyCode: Int): Boolean {
    return when (keyCode) {
        KeyEvent.KEYCODE_DPAD_UP,
        KeyEvent.KEYCODE_DPAD_DOWN,
        KeyEvent.KEYCODE_DPAD_LEFT,
        KeyEvent.KEYCODE_DPAD_RIGHT,
        KeyEvent.KEYCODE_DPAD_CENTER,
        KeyEvent.KEYCODE_ENTER,
        KeyEvent.KEYCODE_NUMPAD_ENTER,
        KeyEvent.KEYCODE_BACK,
        KeyEvent.KEYCODE_MENU,
        KeyEvent.KEYCODE_BUTTON_A,
        KeyEvent.KEYCODE_BUTTON_B,
        KeyEvent.KEYCODE_BUTTON_SELECT,
        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
        KeyEvent.KEYCODE_MEDIA_PLAY,
        KeyEvent.KEYCODE_MEDIA_PAUSE,
        KeyEvent.KEYCODE_MEDIA_REWIND,
        KeyEvent.KEYCODE_MEDIA_FAST_FORWARD,
        KeyEvent.KEYCODE_MEDIA_NEXT,
        KeyEvent.KEYCODE_MEDIA_PREVIOUS -> true
        else -> false
    }
}

private fun shouldDropRepeat(keyCode: Int, repeat: Int): Boolean {
    if (repeat <= 0) return false

    return when (keyCode) {
        KeyEvent.KEYCODE_DPAD_CENTER,
        KeyEvent.KEYCODE_ENTER,
        KeyEvent.KEYCODE_NUMPAD_ENTER,
        KeyEvent.KEYCODE_BACK,
        KeyEvent.KEYCODE_MENU,
        KeyEvent.KEYCODE_BUTTON_A,
        KeyEvent.KEYCODE_BUTTON_B,
        KeyEvent.KEYCODE_BUTTON_SELECT -> true
        else -> false
    }
}

private fun sendBaoflixTvKeyToWeb(webView: WebView, keyCode: Int, repeat: Int) {
    val js = """
        window.dispatchEvent(new CustomEvent('baoflix-native-remote-key', {
          detail: {
            keyCode: $keyCode,
            repeat: $repeat,
            source: 'android-webview'
          }
        }));
        true;
    """.trimIndent()

    webView.evaluateJavascript(js, null)
}

override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val keyCode = event.keyCode

    if (!isBaoflixTvRemoteKey(keyCode)) {
        return super.dispatchKeyEvent(event)
    }

    if (event.action != KeyEvent.ACTION_DOWN) {
        return true
    }

    if (shouldDropRepeat(keyCode, event.repeatCount)) {
        return true
    }

    sendBaoflixTvKeyToWeb(webView, keyCode, event.repeatCount)
    return true
}

// Trong onCreate, sau khi tạo webView:
// webView.prepareBaoflixTvWebView()
// webView.loadUrl("https://baoflix.vercel.app/tv?tv=1")
