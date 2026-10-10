import AppKit

// Wires the daemon's event stream to the overlay once the app has started.
@MainActor
final class Controller: NSObject, NSApplicationDelegate {
  private var overlay: Overlay?
  private var stream: EventStream?

  func applicationDidFinishLaunching(_ notification: Notification) {
    let port = ProcessInfo.processInfo.environment["CLAUDIE_PORT"] ?? "47321"
    guard let url = URL(string: "http://127.0.0.1:\(port)/events") else {
      fatalError("bad CLAUDIE_PORT \(port)")
    }
    let overlay = Overlay()
    let stream = EventStream(url: url) { snapshot in
      // EventStream calls back on the main queue, which is where the main actor runs.
      MainActor.assumeIsolated { overlay.show(snapshot) }
    }
    stream.start()
    self.overlay = overlay
    self.stream = stream
  }
}
