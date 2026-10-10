import AppKit

// Wires the daemon's event stream into the scene and carries out what the scene asks for.
@MainActor
final class Controller: NSObject, NSApplicationDelegate {
  private let daemon = DaemonClient()
  private var overlay: Overlay?
  private var stream: EventStream?
  private var chirp: NSSound?

  func applicationDidFinishLaunching(_ notification: Notification) {
    guard let url = Bundle.module.url(forResource: "scene", withExtension: "js"),
      let script = try? String(contentsOf: url, encoding: .utf8)
    else {
      log("scene.js is missing; run `pnpm build`")
      exit(1)
    }
    let engine = Engine(script: script, anchor: UserDefaults.standard.string(forKey: Config.anchorDefaultsKey))
    chirp = NSSound(data: engine.chirp())
    let overlay = Overlay(engine: engine) { [weak self] action in self?.perform(action) }
    let stream = EventStream(url: daemon.eventsURL) { json in
      // EventStream calls back on the main queue, which is where the main actor runs.
      MainActor.assumeIsolated {
        engine.sync(json)
        overlay.tick()
      }
    }
    stream.start()
    self.overlay = overlay
    self.stream = stream
  }

  private func perform(_ action: Action) {
    switch action {
    case .chirp:
      chirp?.stop()
      chirp?.play()
    case .settings(let patch):
      daemon.postSettings(patch)
    case .anchor(let json):
      UserDefaults.standard.set(json, forKey: Config.anchorDefaultsKey)
    }
  }
}
