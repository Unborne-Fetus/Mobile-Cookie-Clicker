import SwiftUI
import UIKit

@main
struct CookiePortIOSApp: App {
    var body: some Scene {
        WindowGroup {
            GameHost()
                .ignoresSafeArea(.all)
                .preferredColorScheme(.dark)
        }
    }
}

private struct GameHost: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> PortViewController { PortViewController() }
    func updateUIViewController(_ controller: PortViewController, context: Context) {}
}
