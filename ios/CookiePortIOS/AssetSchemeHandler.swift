import Foundation
import WebKit

/// Expose the copied game and locally installed mods from the app bundle through
/// one origin. WKWebView cannot run the desktop Steam/Electron server directly.
final class AssetSchemeHandler: NSObject, WKURLSchemeHandler {
    private let websiteRoot: URL? = Bundle.main.resourceURL?.appendingPathComponent("Website", isDirectory: true)

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              url.scheme == "cookieport", url.host == "app",
              let root = websiteRoot?.standardizedFileURL else {
            fail(urlSchemeTask)
            return
        }
        let path = url.path.removingPercentEncoding ?? url.path
        let segments = path.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
        guard !segments.isEmpty,
              !segments.contains(".."), !segments.contains("."),
              !segments.contains(where: { $0.contains("\\") || $0.contains("\0") }),
              segments.count < 20 else {
            fail(urlSchemeTask)
            return
        }
        let file = segments.reduce(root) { $0.appendingPathComponent($1) }.standardizedFileURL
        guard file.path.hasPrefix(root.path + "/"),
              (try? file.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true,
              let data = try? Data(contentsOf: file) else {
            fail(urlSchemeTask)
            return
        }
        let mime = contentType(for: file.pathExtension.lowercased())
        let response = URLResponse(url: url, mimeType: mime,
                                   expectedContentLength: data.count,
                                   textEncodingName: mime.hasPrefix("text/") || mime == "application/javascript" || mime == "application/json" ? "utf-8" : nil)
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}

    private func fail(_ task: any WKURLSchemeTask) {
        task.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist))
    }

    private func contentType(for ext: String) -> String {
        switch ext {
        case "html", "htm": return "text/html"
        case "css": return "text/css"
        case "js", "mjs": return "application/javascript"
        case "json": return "application/json"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "webp": return "image/webp"
        case "svg": return "image/svg+xml"
        case "ico": return "image/x-icon"
        case "mp3": return "audio/mpeg"
        case "ogg": return "audio/ogg"
        case "wav": return "audio/wav"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "ttf": return "font/ttf"
        case "otf": return "font/otf"
        case "wasm": return "application/wasm"
        default: return "application/octet-stream"
        }
    }
}
