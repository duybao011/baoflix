// Gợi ý chèn vào Activity chứa WebView của APK TV.
// Đổi package/class/biến webView theo project APK của bạn.

webView.settings.javaScriptEnabled = true
webView.addJavascriptInterface(
    BaoFlixTVBridge(this, webView),
    "BaoFlixTVNative"
)

override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val currentUrl = webView.url ?: ""
    val isWatchPage = currentUrl.contains("/xem/")

    if (isWatchPage && event.action == KeyEvent.ACTION_DOWN) {
        when (event.keyCode) {
            KeyEvent.KEYCODE_MEDIA_REWIND,
            KeyEvent.KEYCODE_DPAD_LEFT -> {
                webView.evaluateJavascript(
                    "window.BaoFlixTVWeb && window.BaoFlixTVWeb.onNativeSeekKey && window.BaoFlixTVWeb.onNativeSeekKey('backward');",
                    null
                )
                return true
            }

            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD,
            KeyEvent.KEYCODE_DPAD_RIGHT -> {
                webView.evaluateJavascript(
                    "window.BaoFlixTVWeb && window.BaoFlixTVWeb.onNativeSeekKey && window.BaoFlixTVWeb.onNativeSeekKey('forward');",
                    null
                )
                return true
            }
        }
    }

    return super.dispatchKeyEvent(event)
}
