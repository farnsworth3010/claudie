import Foundation
import JavaScriptCore

// The scene logic (backend/core, bundled into scene.js), run in JavaScriptCore. Points are
// global, in screen points with y growing downwards from the top of the first screen.
@MainActor
final class Engine {
  private let context: JSContext
  private let api: JSValue
  private let decoder = JSONDecoder()
  private let encoder = JSONEncoder()
  private var lastView: (json: String, view: SceneView)?

  init(script: String, anchor: String?) {
    context = JSContext()!
    context.exceptionHandler = { _, exception in log("js: \(exception?.toString() ?? "unknown error")") }
    context.evaluateScript(script, withSourceURL: URL(string: "claudie:///scene.js"))
    api = context.objectForKeyedSubscript("claudie")
    invoke("start", [anchor ?? ""])
  }

  func setScreens(_ screens: [SceneScreen]) {
    guard let data = try? encoder.encode(screens) else { return }
    invoke("setScreens", [String(decoding: data, as: UTF8.self)])
  }

  func sync(_ snapshot: String) {
    invoke("sync", [snapshot])
  }

  // `changed` is false when the view is the same as last tick's, which at rest is most ticks: the
  // JSON isn't decoded again.
  func tick(_ pointer: CGPoint?) -> (view: SceneView, changed: Bool)? {
    let x = pointer.map { Double($0.x) } ?? .nan
    let y = pointer.map { Double($0.y) } ?? .nan
    let json = invoke("tick", [x, y])?.toString() ?? ""
    if let last = lastView, last.json == json { return (last.view, false) }
    do {
      let view = try decoder.decode(SceneView.self, from: Data(json.utf8))
      lastView = (json, view)
      return (view, true)
    } catch {
      log("bad view: \(error)")
      return nil
    }
  }

  func hit(_ p: CGPoint) -> Bool {
    invoke("hit", at: p)?.toBool() ?? false
  }

  func press(_ p: CGPoint) -> Bool {
    invoke("press", at: p)?.toBool() ?? false
  }

  func motion(_ p: CGPoint) {
    invoke("motion", at: p)
  }

  func release() {
    invoke("release")
  }

  func zoom(_ delta: Double) {
    invoke("zoom", [delta])
  }

  // How long since the last keyboard or mouse input, for the break reminder.
  func idle(_ idleMs: Double) {
    invoke("idle", [idleMs])
  }

  func takeActions() -> [Action] {
    let json = invoke("takeActions")?.toString() ?? "[]"
    let objects = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [[String: Any]] ?? []
    return objects.compactMap { object -> Action? in
      guard let action = Action(object) else {
        log("unknown action \(object)")
        return nil
      }
      return action
    }
  }

  // A WAV file.
  func chirp() -> Data {
    let json = invoke("chirp")?.toString() ?? "[]"
    return Data((try? decoder.decode([UInt8].self, from: Data(json.utf8))) ?? [])
  }

  @discardableResult
  private func invoke(_ method: String, _ arguments: [Any] = []) -> JSValue? {
    api.invokeMethod(method, withArguments: arguments)
  }

  @discardableResult
  private func invoke(_ method: String, at point: CGPoint) -> JSValue? {
    invoke(method, [Double(point.x), Double(point.y)])
  }
}
