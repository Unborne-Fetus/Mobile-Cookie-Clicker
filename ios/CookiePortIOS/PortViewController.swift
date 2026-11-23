import Foundation
import UIKit
import WebKit
import UniformTypeIdentifiers

final class PortViewController: UIViewController, WKNavigationDelegate, UIDocumentPickerDelegate {
    private let gameURL = URL(string: "cookieport://app/game/index.html")!
    private let onlineURL = URL(string: "https://orteil.dashnet.org/cookieclicker/")!
    private let steamURL = URL(string: "https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=1454400")!
    private let lastPlayersKey = "cookieIOS.heraldPlayers"
    private let lastWhenKey = "cookieIOS.heraldWhen"
    private let localModeKey = "cookieIOS.localMode"
    private var webView: WKWebView!
    private var menuButton: UIButton!
    private var heraldTimer: Timer?
    private var heraldTask: URLSessionDataTask?
    private var observers: [NSObjectProtocol] = []
    private var isLocal = true
    private let fileLimit = 2_000_000

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.11, green: 0.08, blue: 0.07, alpha: 1)
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()  // Persistent game/mod localStorage.
        config.setURLSchemeHandler(AssetSchemeHandler(), forURLScheme: "cookieport")
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.allowsInlineMediaPlayback = true
        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .black
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leftAnchor.constraint(equalTo: view.leftAnchor),
            webView.rightAnchor.constraint(equalTo: view.rightAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        let button = UIButton(type: .system)
        menuButton = button
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle("☰", for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 25, weight: .semibold)
        button.tintColor = .white
        button.backgroundColor = UIColor.black.withAlphaComponent(0.65)
        button.layer.cornerRadius = 10
        button.accessibilityLabel = "Open port controls"
        button.addTarget(self, action: #selector(showMenu), for: .touchUpInside)
        view.addSubview(button)
        NSLayoutConstraint.activate([
            button.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 5),
            button.rightAnchor.constraint(equalTo: view.safeAreaLayoutGuide.rightAnchor, constant: -8),
            button.widthAnchor.constraint(equalToConstant: 46),
            button.heightAnchor.constraint(equalToConstant: 46)
        ])
        isLocal = UserDefaults.standard.object(forKey: localModeKey) as? Bool ?? true
        loadPage()
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification,
                                                                  object: nil, queue: .main) { [weak self] _ in self?.saveNow() })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,
                                                                  object: nil, queue: .main) { [weak self] _ in self?.refreshHeralds() })
        heraldTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            self?.refreshHeralds()
        }
    }

    deinit {
        heraldTimer?.invalidate()
        heraldTask?.cancel()
        observers.forEach { NotificationCenter.default.removeObserver($0) }
    }

    private func loadPage() {
        if isLocal {
            webView.load(URLRequest(url: gameURL))
        } else {
            webView.load(URLRequest(url: onlineURL))
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if isLocal && webView.url?.scheme == "cookieport" {
            deliverCachedHeralds()
            refreshHeralds()
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "cookieport" || (url.host == onlineURL.host && !isLocal) {
            decisionHandler(.allow)
            return
        }
        if url.scheme == "https" || url.scheme == "http" {
            if action.targetFrame == nil || action.navigationType == .linkActivated {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showAlert("Page failed to load", error.localizedDescription)
    }

    private func runJS(_ js: String, done: ((Any?) -> Void)? = nil) {
        webView.evaluateJavaScript(js) { value, _ in done?(value) }
    }

    private func saveNow() {
        runJS("try{if(window.Game && Game.ready && Game.WriteSave)Game.WriteSave(0);}catch(e){}")
    }

    @objc private func showMenu() {
        let sheet = UIAlertController(title: "Cookie Clicker iOS", message: "Private desktop-game port", preferredStyle: .actionSheet)
        func item(_ title: String, _ action: @escaping () -> Void) {
            sheet.addAction(UIAlertAction(title: title, style: .default) { _ in action() })
        }
        item("Manage mods (Options → Mods)") { [weak self] in
            self?.runJS("if(window.CookieSteamMods)CookieSteamMods.open();")
        }
        item("Disable all mods and restart (safe mode)") { [weak self] in
            self?.runJS("if(window.CookieSteamMods)CookieSteamMods.disableAllAndReload();")
        }
        item("Export save") { [weak self] in self?.exportSave() }
        item("Import save") { [weak self] in self?.askImport() }
        item("Zoom in") { [weak self] in self?.adjustZoom(0.1) }
        item("Zoom out") { [weak self] in self?.adjustZoom(-0.1) }
        item("Toggle narrow window (press achievement)") { [weak self] in self?.layout("toggleNarrow") }
        item("Toggle short cookie panel (dunker achievement)") { [weak self] in self?.layout("toggleShort") }
        item("Achievement layout diagnostics") { [weak self] in self?.layout("status") }
        item("Restore normal layout") { [weak self] in self?.layout("restore") }
        item("Herald status (Steam players)") { [weak self] in self?.showHeraldStatus() }
        item("Reload game") { [weak self] in self?.saveNow(); self?.webView.reload() }
        item(isLocal ? "Switch to official online game" : "Switch to bundled offline game") { [weak self] in
            self?.confirmSwitch()
        }
        sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        sheet.popoverPresentationController?.sourceView = menuButton
        sheet.popoverPresentationController?.sourceRect = menuButton.bounds
        present(sheet, animated: true)
    }

    private func adjustZoom(_ change: CGFloat) {
        webView.pageZoom = min(2, max(0.6, webView.pageZoom + change))
    }

    private func layout(_ method: String) {
        // Whitelist the four functions exposed by our source-only UI compatibility shim.
        guard ["toggleNarrow", "toggleShort", "status", "restore"].contains(method) else { return }
        runJS("window.CookiePortAchievementLayout ? CookiePortAchievementLayout.\(method)() : 'Layout helper not ready'") { [weak self] result in
            self?.showAlert(method == "status" ? "Achievement layout" : "Panel layout", result as? String ?? "Game is loading")
        }
    }

    private func confirmSwitch() {
        let alert = UIAlertController(title: "Switch game source?",
                                      message: "The local Steam files and the online game keep independent saves. Export first if needed.",
                                      preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Switch", style: .default) { [weak self] _ in
            guard let self = self else { return }
            self.saveNow()
            self.isLocal.toggle()
            UserDefaults.standard.set(self.isLocal, forKey: self.localModeKey)
            self.loadPage()
        })
        present(alert, animated: true)
    }

    private func exportSave() {
        runJS("(function(){try{return window.Game&&Game.ready&&Game.WriteSave?Game.WriteSave(1):null;}catch(e){return null;}})()") { [weak self] result in
            guard let self = self else { return }
            guard let save = result as? String, !save.isEmpty else {
                self.showAlert("Export unavailable", "Wait until the game finishes loading, then try again.")
                return
            }
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("cookie-clicker-save.txt")
            do {
                try save.write(to: url, atomically: true, encoding: .utf8)
                let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                share.popoverPresentationController?.sourceView = self.menuButton
                share.popoverPresentationController?.sourceRect = self.menuButton.bounds
                self.present(share, animated: true)
            } catch {
                self.showAlert("Export failed", error.localizedDescription)
            }
        }
    }

    private func askImport() {
        let alert = UIAlertController(title: "Import save?", message: "This replaces the current save. Export a backup first.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Choose file", style: .default) { [weak self] _ in
            guard let self = self else { return }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.plainText, .text, .data], asCopy: true)
            picker.delegate = self
            self.present(picker, animated: true)
        })
        present(alert, animated: true)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else { return }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url)
            guard data.count <= fileLimit, let save = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines), !save.isEmpty else {
                showAlert("Import failed", "The save is empty, not UTF-8 text, or exceeds 2 MB.")
                return
            }
            let json = String(data: try JSONSerialization.data(withJSONObject: [save], options: [.fragmentsAllowed]), encoding: .utf8) ?? "[]"
            // Encode the file text as JSON, never interpolate untrusted text as JS source.
            runJS("(function(){try{if(!window.Game||!Game.ready||!Game.ImportSaveCode)return 'Not ready';Game.ImportSaveCode(\(json)[0]);return 'Import submitted';}catch(e){return 'Import error';}})()") { [weak self] result in
                self?.showAlert("Save import", result as? String ?? "Unavailable")
            }
        } catch {
            showAlert("Import failed", error.localizedDescription)
        }
    }

    private func showAlert(_ title: String, _ message: String) {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    // MARK: Steam concurrent players → native Herald update (5 minute refresh)
    private func deliverCachedHeralds() {
        let players = UserDefaults.standard.object(forKey: lastPlayersKey) as? Int
        let when = UserDefaults.standard.object(forKey: lastWhenKey) as? Double
        if let count = players, let millis = when, count >= 0 {
            deliverHeralds(players: count, timestamp: millis, cached: true)
        }
    }

    private func deliverHeralds(players: Int, timestamp: Double, cached: Bool) {
        guard isLocal, webView.url?.scheme == "cookieport" else { return }
        let stamp = Int64(timestamp)
        runJS("if(window.CookieIOSHeralds)CookieIOSHeralds.receive(\(players),\(stamp),\(cached ? "true" : "false"));")
    }

    private func refreshHeralds() {
        guard isLocal, heraldTask == nil else { return }
        var request = URLRequest(url: steamURL)
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.heraldTask = nil
                guard error == nil, (response as? HTTPURLResponse)?.statusCode == 200,
                      let data = data, data.count < 8192,
                      let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                      let body = obj["response"] as? [String: Any],
                      let status = body["result"] as? Int, status == 1,
                      let players = body["player_count"] as? Int,
                      players >= 0, players <= 2_000_000_000 else {
                    self.deliverCachedHeralds()
                    return
                }
                let timestamp = Date().timeIntervalSince1970 * 1000
                UserDefaults.standard.set(players, forKey: self.lastPlayersKey)
                UserDefaults.standard.set(timestamp, forKey: self.lastWhenKey)
                self.deliverHeralds(players: players, timestamp: timestamp, cached: false)
            }
        }
        heraldTask = task
        task.resume()
    }

    private func showHeraldStatus() {
        let players = UserDefaults.standard.object(forKey: lastPlayersKey) as? Int
        let millis = UserDefaults.standard.object(forKey: lastWhenKey) as? Double
        guard isLocal else { showAlert("Heralds", "The Steam-based replacement applies only to local Steam-game mode."); return }
        guard let count = players, let last = millis else {
            showAlert("Heralds", "No confirmed Steam-player count yet. Connect to the internet and reload the game.")
            refreshHeralds()
            return
        }
        let age = max(0, Int((Date().timeIntervalSince1970 * 1000 - last) / 60000))
        showAlert("Heralds", "Confirmed concurrent Steam players: \(count)\nHeralds shown: \(min(100, count / 100))\nLast successful update: \(age) minutes ago\nCpS bonus requires the Heralds heavenly upgrade.")
        refreshHeralds()
    }
}
