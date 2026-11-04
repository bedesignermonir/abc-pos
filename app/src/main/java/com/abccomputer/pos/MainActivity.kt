package com.abccomputer.pos

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingGoogleSignInCallback: String? = null
    private val googleSignInLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callbackId = pendingGoogleSignInCallback ?: return@registerForActivityResult
        pendingGoogleSignInCallback = null

        try {
            val account = GoogleSignIn.getSignedInAccountFromIntent(result.data)
                .getResult(ApiException::class.java)
            val idToken = account.idToken
            if (idToken.isNullOrBlank()) {
                resolveGoogleSignIn(callbackId, error = "Google did not return an ID token.")
            } else {
                resolveGoogleSignIn(callbackId, idToken = idToken)
            }
        } catch (error: ApiException) {
            val message = if (error.statusCode == 12501) {
                "Google Sign-In was cancelled."
            } else {
                error.localizedMessage ?: "Google Sign-In failed (status ${error.statusCode})."
            }
            resolveGoogleSignIn(callbackId, error = message)
        } catch (error: Exception) {
            resolveGoogleSignIn(callbackId, error = error.localizedMessage ?: "Google Sign-In failed.")
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        setupWebView()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        webView.loadUrl("file:///android_asset/index.html")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        settings.setSupportZoom(true)
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        webView.addJavascriptInterface(WebAppInterface(this), "AndroidApp")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false

                if (url.startsWith("whatsapp:") || url.contains("wa.me") || url.contains("api.whatsapp.com")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        Toast.makeText(this@MainActivity, "WhatsApp ইনস্টল করা নেই", Toast.LENGTH_SHORT).show()
                        return true
                    }
                }

                if (url.startsWith("tel:")) {
                    try {
                        val intent = Intent(Intent.ACTION_DIAL, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        return false
                    }
                }

                if (url.startsWith("mailto:")) {
                    try {
                        val intent = Intent(Intent.ACTION_SENDTO, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        return false
                    }
                }

                return false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("ABC Computer POS")
                    .setMessage(message ?: "")
                    .setPositiveButton("ঠিক আছে") { _, _ -> result?.confirm() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }

            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("নিশ্চিত করুন")
                    .setMessage(message ?: "")
                    .setPositiveButton("হ্যাঁ") { _, _ -> result?.confirm() }
                    .setNegativeButton("না") { _, _ -> result?.cancel() }
                    .setOnCancelListener { result?.cancel() }
                    .show()
                return true
            }
        }
    }

    private fun resolveGoogleSignIn(callbackId: String, idToken: String? = null, error: String? = null) {
        val script = "if (typeof window.onNativeGoogleSignInResult === 'function') window.onNativeGoogleSignInResult(" +
            "${JSONObject.quote(callbackId)}, " +
            "${idToken?.let { JSONObject.quote(it) } ?: "null"}, " +
            "${error?.let { JSONObject.quote(it) } ?: "null"});"
        webView.evaluateJavascript(script, null)
    }

    inner class WebAppInterface(private val context: Context) {
        @JavascriptInterface
        fun signInWithGoogle(callbackId: String) {
            runOnUiThread {
                if (pendingGoogleSignInCallback != null) {
                    resolveGoogleSignIn(callbackId, error = "Google Sign-In is already in progress.")
                    return@runOnUiThread
                }

                pendingGoogleSignInCallback = callbackId
                val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestIdToken(getString(R.string.google_web_client_id))
                    .requestEmail()
                    .build()
                try {
                    googleSignInLauncher.launch(GoogleSignIn.getClient(this@MainActivity, options).signInIntent)
                } catch (error: Exception) {
                    pendingGoogleSignInCallback = null
                    resolveGoogleSignIn(callbackId, error = error.localizedMessage ?: "Google Sign-In could not be started.")
                }
            }
        }

        @JavascriptInterface
        fun openHostedApp() {
            runOnUiThread {
                try {
                    startActivity(
                        Intent(
                            Intent.ACTION_VIEW,
                            Uri.parse("https://bedesignermonir.github.io/abc-pos/")
                        )
                    )
                } catch (e: Exception) {
                    Toast.makeText(context, "ব্রাউজার খোলা যায়নি", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface
        fun printInvoice(jobName: String) {
            runOnUiThread {
                val printManager = getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return@runOnUiThread
                val adapter = webView.createPrintDocumentAdapter(jobName)
                printManager.print(jobName, adapter, PrintAttributes.Builder().build())
            }
        }

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread {
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
        }
    }
}
