import AppKit

// The scene's coordinates are global points, y growing downwards from the top of the first screen;
// Cocoa's grow upwards from its bottom. The flip lives here. A snapshot of the screens: asking
// NSScreen on every tick is a round trip to the window server each time.
@MainActor
struct SceneSpace {
  let top: CGFloat
  let screenFrames: [CGRect]  // in scene coordinates

  static func current() -> SceneSpace {
    let top = NSScreen.screens.first?.frame.maxY ?? 0
    let flip = SceneSpace(top: top, screenFrames: [])
    return SceneSpace(top: top, screenFrames: NSScreen.screens.map { flip.toScene($0.frame) })
  }

  func toCocoa(_ rect: CGRect) -> CGRect { flipped(rect) }
  func toScene(_ rect: CGRect) -> CGRect { flipped(rect) }

  // The frame of the screen a scene point is on, in scene coordinates.
  func screen(containing point: CGPoint) -> CGRect? {
    screenFrames.first { $0.contains(point) }
  }

  func pointer() -> CGPoint {
    let location = NSEvent.mouseLocation
    return CGPoint(x: location.x, y: top - location.y)
  }

  // The flip is its own inverse.
  private func flipped(_ rect: CGRect) -> CGRect {
    CGRect(x: rect.minX, y: top - rect.maxY, width: rect.width, height: rect.height)
  }
}
