import AppKit

// An accessory app: no Dock icon and no menu bar, so the overlay never takes the focus from the terminal.
@main
@MainActor
enum App {
  static func main() {
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    let controller = Controller()
    app.delegate = controller
    // The app holds its delegate weakly; keep the controller alive while the app runs.
    withExtendedLifetime(controller) { app.run() }
  }
}
