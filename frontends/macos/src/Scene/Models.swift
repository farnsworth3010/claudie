import CoreGraphics
import Foundation

// What the scene returns for one frame.
struct SceneView: Decodable {
  let sprites: [SpriteDraw]  // back to front
  let tooltip: Tooltip?
  let opacity: Double
  let overFullscreen: Bool
  let clickThrough: Bool
  let overDock: Bool
  let overMenuBar: Bool
  let fast: Bool
}

struct SpriteDraw: Decodable {
  let id: Int
  let pixels: [UInt8]?  // only the first time an id appears
  let w: Int
  let h: Int
  let palette: String
  let x: Double
  let y: Double
  let px: Double
  let opacity: Double

  var rect: CGRect {
    CGRect(x: x, y: y, width: Double(w) * px, height: Double(h) * px)
  }
}

struct Tooltip: Decodable, Equatable {
  let text: String
  let x: Double  // centre
  let y: Double  // bottom edge
}

// What the app tells the scene about each screen.
struct SceneScreen: Encodable {
  let id: Int
  let area: SceneRect
}

struct SceneRect: Encodable {
  let x: Double
  let y: Double
  let width: Double
  let height: Double

  init(_ rect: CGRect) {
    x = Double(rect.minX)
    y = Double(rect.minY)
    width = Double(rect.width)
    height = Double(rect.height)
  }
}

// What the scene asks the app to do. The payloads stay raw JSON: the app only forwards them.
enum Action {
  case chirp
  case settings(patch: Data)  // POSTed to the daemon as is
  case anchor(json: String)  // stored as is and handed back to the scene on the next start

  init?(_ object: [String: Any]) {
    switch object["type"] as? String {
    case "chirp":
      self = .chirp
    case "settings":
      guard let patch = object["patch"].flatMap(Action.jsonData) else { return nil }
      self = .settings(patch: patch)
    case "anchor":
      guard let anchor = object["anchor"].flatMap(Action.jsonData) else { return nil }
      self = .anchor(json: String(decoding: anchor, as: UTF8.self))
    default:
      return nil
    }
  }

  private static func jsonData(_ value: Any) -> Data? {
    guard JSONSerialization.isValidJSONObject(value) else { return nil }
    return try? JSONSerialization.data(withJSONObject: value)
  }
}
