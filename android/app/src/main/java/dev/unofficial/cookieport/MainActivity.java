package dev.unofficial.cookieport;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.DocumentsContract;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.nio.charset.StandardCharsets;

/** Independent Android shell. Does not contain Cookie Clicker game code or artwork. */
public final class MainActivity extends Activity {
    private static final String ONLINE_URL = "https://orteil.dashnet.org/cookieclicker/";
    private static final String LOCAL_URL = "https://appassets.androidplatform.net/assets/game/index.html";
    private static final String PREFS = "cookie_port_settings";
    private static final String KEY_LOCAL = "local_mode";
    private static final int REQUEST_EXPORT = 1041;
    private static final int REQUEST_IMPORT = 1042;
    private static final int MAX_IMPORT_BYTES = 2_000_000;
    private static final String STEAM_COUNT_URL =
            "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=1454400";
    private static final String KEY_HERALD_PLAYERS = "herald_steam_players";
    private static final String KEY_HERALD_TIMESTAMP = "herald_steam_last_success";
    private static final long HERALD_REFRESH_MS = 5L * 60L * 1000L;
    private final Handler heraldHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService heraldExecutor = Executors.newSingleThreadExecutor();
    private boolean heraldInFlight = false;
    private boolean destroyed = false;
    private final Runnable heraldTicker = new Runnable() {
        @Override public void run() {
            if (!destroyed && localMode && web != null) requestHeraldUpdate();
            if (!destroyed) heraldHandler.postDelayed(this, HERALD_REFRESH_MS);
        }
    };
    private WebView web;
    private boolean hasLocal;
    private boolean localMode;
    private String pendingExport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        hasLocal = assetExists("game/index.html");
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        localMode = p.getBoolean(KEY_LOCAL, hasLocal) && hasLocal;
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web = new WebView(this);
        web.setBackgroundColor(0xFF1D1511);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri uri = req.getUrl();
                if ("appassets.androidplatform.net".equals(uri.getHost())
                        && "/assets/game/index.html".equals(uri.getPath())) {
                    WebResourceResponse modified = interceptLocalGameIndex();
                    if (modified != null) return modified;
                }
                return loader.shouldInterceptRequest(uri);
            }
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (localMode && url.startsWith(LOCAL_URL)) {
                    deliverCachedHeralds();
                    requestHeraldUpdate();
                }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                // Keep only the actual game origin in-app. Social/store links open externally.
                Uri u = req.getUrl();
                String host = u.getHost();
                if ("appassets.androidplatform.net".equals(host)
                        || "orteil.dashnet.org".equals(host)) return false;
                if ("https".equals(u.getScheme()) || "http".equals(u.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
                    catch (ActivityNotFoundException ignored) { toast("No browser available"); }
                }
                return true;
            }
        });
        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        TextView menu = new TextView(this);
        menu.setText("☰");
        menu.setGravity(Gravity.CENTER);
        menu.setTextSize(23);
        menu.setTextColor(0xFFFFFFFF);
        menu.setBackgroundColor(0xBB28201C);
        menu.setContentDescription("Open port menu");
        menu.setOnClickListener(v -> showMenu());
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(47), dp(47),
                Gravity.TOP | Gravity.END);
        lp.topMargin = dp(9); lp.rightMargin = dp(9);
        root.addView(menu, lp);
        setContentView(root);
        web.loadUrl(localMode ? LOCAL_URL : ONLINE_URL);
        if (!hasLocal) toast("Online version: add your own game files for offline mode");
    }

    private boolean assetExists(String asset) {
        try (InputStream ignored = getAssets().open(asset)) { return true; }
        catch (IOException e) { return false; }
    }

    private int dp(int p) { return Math.round(getResources().getDisplayMetrics().density * p); }
    private void toast(String m) { Toast.makeText(this, m, Toast.LENGTH_LONG).show(); }

    private void showMenu() {
        String modeText = localMode ? "Switch to official online game" : "Switch to personal offline files";
        String[] items = {"Disable all bundled mods and restart (safe mode)", "Export save to file", "Import save from file", "Zoom in", "Zoom out",
                "Toggle narrow window (ticker achievement)",
                "Toggle short cookie panel (dunker achievement)", "Check achievement layout status",
                "Restore normal window layout", "Reload game", modeText,
                "Herald status (live Steam players)", "About"};
        new AlertDialog.Builder(this).setTitle("Desktop port controls")
                .setItems(items, (d, index) -> {
                    switch (index) {
                        case 0: web.evaluateJavascript("if(window.CookieSteamMods) CookieSteamMods.disableAllAndReload();", null); break;
                        case 1: exportSave(); break;
                        case 2: confirmImport(); break;
                        case 3: web.zoomIn(); break;
                        case 4: web.zoomOut(); break;
                        case 5: runLayoutHelper("toggleNarrow", false); break;
                        case 6: runLayoutHelper("toggleShort", false); break;
                        case 7: runLayoutHelper("status", true); break;
                        case 8: runLayoutHelper("restore", false); break;
                        case 9: saveNow(); web.reload(); break;
                        case 10: switchMode(); break;
                        case 11: showHeraldStatus(); break;
                        case 12: new AlertDialog.Builder(this).setTitle("Unofficial desktop port shell")
                                .setMessage("Runs the official online game or personally supplied local files. " +
                                        "Not affiliated with Orteil or DashNet. The desktop Steam mod manager uses Electron; this build uses the original in-game Options area with Android-compatible mod loading. " +
                                        "Offline and online modes have independent saves.")
                                .setPositiveButton("OK", null).show(); break;
                    }
                }).show();
    }

    /** Adapt Steam's HTML entrypoint without altering the user's copied source files.
     * The original Electron-only steam.js cannot run in Android WebView. */
    private WebResourceResponse interceptLocalGameIndex() {
        try (InputStream in = getAssets().open("game/index.html")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) {
                if (bytes.size() + n > 2_000_000) return null;
                bytes.write(buf, 0, n);
            }
            String html = bytes.toString(StandardCharsets.UTF_8.name());
            // Ignore the desktop Electron bootstrap. Leave the original files untouched.
            html = html.replace("<script src=\"../steam/steam.js\"></script>", "");
            int end = html.toLowerCase(java.util.Locale.ROOT).indexOf("</head>");
            if (end == -1) return null;
            html = html.substring(0, end)
                    + "<link rel=\"stylesheet\" href=\"/assets/android-touch-compat.css\">\n"
                    + "<script src=\"/assets/steam-snapshot-mods.js\"></script>\n"
                    + "<script src=\"/assets/android-heralds.js\"></script>\n"
                    + html.substring(end);
            return new WebResourceResponse("text/html", "UTF-8",
                    new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { return null; }
    }

    /** Never expose a privileged JavaScript bridge or API token to the page. */
    private void deliverHeraldCount(int players, long timestamp, boolean cached) {
        if (web == null || !localMode || destroyed || web.getUrl() == null ||
                !web.getUrl().startsWith(LOCAL_URL)) return;
        String js = "if(window.CookieAndroidHeralds)CookieAndroidHeralds.receive(" +
                players + "," + timestamp + "," + (cached ? "true" : "false") + ");";
        web.evaluateJavascript(js, null);
    }

    private void deliverCachedHeralds() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        int previous = prefs.getInt(KEY_HERALD_PLAYERS, -1);
        long when = prefs.getLong(KEY_HERALD_TIMESTAMP, 0L);
        if (previous >= 0 && when > 0) deliverHeraldCount(previous, when, true);
    }

    private void requestHeraldUpdate() {
        if (!localMode || destroyed || heraldInFlight) return;
        heraldInFlight = true;
        heraldExecutor.execute(() -> {
            Integer result = null;
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(STEAM_COUNT_URL).openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                connection.setUseCaches(false);
                connection.setRequestProperty("Accept", "application/json");
                if (connection.getResponseCode() == HttpURLConnection.HTTP_OK) {
                    try (InputStream stream = connection.getInputStream()) {
                        ByteArrayOutputStream response = new ByteArrayOutputStream();
                        byte[] buf = new byte[1024]; int got;
                        while ((got = stream.read(buf)) != -1) {
                            if (response.size() + got > 8192) throw new IOException("Oversized Steam response");
                            response.write(buf, 0, got);
                        }
                        JSONObject root = new JSONObject(response.toString(StandardCharsets.UTF_8.name()));
                        JSONObject data = root.getJSONObject("response");
                        if (data.optInt("result", 0) == 1) {
                            int players = data.getInt("player_count");
                            if (players >= 0) result = players;
                        }
                    }
                }
            } catch (Exception ignored) {
                // Keep the last confirmed count. Never replace it with 0 on
                // timeout, offline mode, non-200 status, or an invalid payload.
            } finally {
                if (connection != null) connection.disconnect();
            }
            final Integer fetched = result;
            heraldHandler.post(() -> {
                heraldInFlight = false;
                if (destroyed) return;
                if (fetched != null) {
                    long now = System.currentTimeMillis();
                    getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                            .putInt(KEY_HERALD_PLAYERS, fetched)
                            .putLong(KEY_HERALD_TIMESTAMP, now).apply();
                    deliverHeraldCount(fetched, now, false);
                } else {
                    deliverCachedHeralds();
                }
            });
        });
    }

    private void showHeraldStatus() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        int players = prefs.getInt(KEY_HERALD_PLAYERS, -1);
        long when = prefs.getLong(KEY_HERALD_TIMESTAMP, 0L);
        String detail;
        if (!localMode) detail = "The Herald replacement applies only to the offline Steam-game build.";
        else if (players < 0 || when <= 0) detail = "No Steam player count retrieved yet. Connect to the internet and reload the game.";
        else {
            long ageMinutes = Math.max(0L, (System.currentTimeMillis() - when) / 60000L);
            detail = "Last confirmed concurrent Steam players: " + players +
                    "\nDisplayed Heralds: " + Math.min(100, players / 100) +
                    "\nLast successful update: " + ageMinutes + " minute(s) ago" +
                    "\nCpS bonus requires the Heralds heavenly upgrade.";
            if (ageMinutes >= 10) detail += "\nOffline/cached value: Steam could not be refreshed recently.";
        }
        new AlertDialog.Builder(this).setTitle("Heralds — Steam player count")
                .setMessage(detail).setPositiveButton("OK", null)
                .setNeutralButton("Refresh now", (d, w) -> requestHeraldUpdate()).show();
    }

    /** Executes our independent layout shim without modifying the user's game files. */
    private void runLayoutHelper(String method, boolean detailed) {
        try (InputStream in = getAssets().open("window-achievement-layout.js")) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[4096];
            int count;
            while ((count = in.read(chunk)) != -1) buffer.write(chunk, 0, count);
            String helper = buffer.toString(StandardCharsets.UTF_8.name());
            String js = helper + "\nwindow.CookiePortAchievementLayout." + method + "();";
            web.evaluateJavascript(js, encoded -> {
                String message = "Game is not ready yet";
                try {
                    Object value = new JSONTokener(encoded).nextValue();
                    if (value instanceof String) message = (String) value;
                } catch (Exception ignored) { }
                if (detailed) new AlertDialog.Builder(this).setTitle("Achievement layout diagnostics")
                        .setMessage(message.replace("\\n", "\n"))
                        .setPositiveButton("OK", null).show();
                else toast(message);
            });
        } catch (IOException e) { toast("Achievement layout helper missing: " + e.getMessage()); }
    }

    private void switchMode() {
        if (!hasLocal && !localMode) {
            toast("No local game assets installed. See README before compiling.");
            return;
        }
        new AlertDialog.Builder(this).setTitle("Switch game source?")
                .setMessage("Local and online versions keep separate save storage. Export your save first.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Switch", (d, w) -> {
                    saveNow(); localMode = !localMode;
                    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(KEY_LOCAL, localMode).apply();
                    web.loadUrl(localMode ? LOCAL_URL : ONLINE_URL);
                }).show();
    }

    private void saveNow() {
        web.evaluateJavascript("try { if (window.Game && Game.ready && Game.WriteSave) Game.WriteSave(0); } catch(e) {}", null);
    }

    private void exportSave() {
        // Evaluate in the live page to preserve compatibility with the game's own save format.
        web.evaluateJavascript("(function(){ try { return (window.Game && Game.ready && Game.WriteSave) " +
                "? Game.WriteSave(1) : null; } catch(e) { return null; } })()", encoded -> {
            try {
                Object parsed = new JSONTokener(encoded).nextValue();
                if (!(parsed instanceof String) || ((String) parsed).isEmpty()) {
                    toast("Game has not finished loading, or export is unavailable"); return;
                }
                pendingExport = (String) parsed;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TITLE, "cookie-clicker-save.txt");
                startActivityForResult(i, REQUEST_EXPORT);
            } catch (Exception e) { toast("Could not read exported save"); }
        });
    }

    private void confirmImport() {
        new AlertDialog.Builder(this).setTitle("Import a save?")
                .setMessage("This replaces your currently loaded save. Export a backup first.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Choose file", (d, w) -> {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("text/*");
                    startActivityForResult(i, REQUEST_IMPORT);
                }).show();
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (result != RESULT_OK || data == null || data.getData() == null) {
            if (request == REQUEST_EXPORT) pendingExport = null;
            return;
        }
        Uri uri = data.getData();
        if (request == REQUEST_EXPORT && pendingExport != null) {
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                if (out == null) throw new IOException("No output stream");
                out.write(pendingExport.getBytes(StandardCharsets.UTF_8));
                toast("Save exported");
            } catch (Exception e) { toast("Could not write save: " + e.getMessage()); }
            finally { pendingExport = null; }
        } else if (request == REQUEST_IMPORT) {
            try (InputStream in = getContentResolver().openInputStream(uri)) {
                if (in == null) throw new IOException("No input stream");
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] chunk = new byte[8192]; int n;
                while ((n = in.read(chunk)) != -1) {
                    if (bytes.size() + n > MAX_IMPORT_BYTES) throw new IOException("Save file too large");
                    bytes.write(chunk, 0, n);
                }
                String save = bytes.toString(StandardCharsets.UTF_8.name()).trim();
                if (save.isEmpty()) throw new IOException("Empty save file");
                String js = "(function(){try{if(!window.Game || !Game.ready || !Game.ImportSaveCode) " +
                        "return 'not ready'; Game.ImportSaveCode(" + JSONObject.quote(save) + ");" +
                        "return 'import sent';}catch(e){return 'error';}})()";
                web.evaluateJavascript(js, status -> {
                    if ("\"import sent\"".equals(status)) toast("Import submitted to game");
                    else toast("Game is not ready to import; try again after it loads");
                });
            } catch (Exception e) { toast("Could not import: " + e.getMessage()); }
        }
    }

    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        // Preserve the live WebView and JavaScript state on phone rotation.
    }
    @Override protected void onResume() {
        super.onResume();
        heraldHandler.removeCallbacks(heraldTicker);
        heraldHandler.post(heraldTicker);
    }
    @Override protected void onPause() {
        saveNow();
        heraldHandler.removeCallbacks(heraldTicker);
        super.onPause();
    }
    @Override public void onBackPressed() { showMenu(); }
    @Override protected void onDestroy() {
        destroyed = true;
        heraldHandler.removeCallbacks(heraldTicker);
        heraldExecutor.shutdownNow();
        if (web != null) { ((ViewGroup) web.getParent()).removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
}
