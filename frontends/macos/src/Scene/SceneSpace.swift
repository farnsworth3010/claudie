import AppKit

// The scene's coordinates are global points, y growing downwards from the top of the first screen;
// Cocoa's grow upwards from its bottom. The flip lives here.
@MainActor
struct SceneSpace {
  let top: CGFloat

  static func current() -> SceneSpace {
    SceneSpace(top: NSScreen.screens.first?.frame.maxY ?? 0)
  }

  func toCocoa(_ rect: CGRect) -> CGRect { flipped(rect) }
  func toScene(_ rect: CGRect) -> CGRect { flipped(rect) }

  // The frame of the screen a scene point is on, in scene coordinates.
  func screen(containing point: CGPoint) -> CGRect? {
    NSScreen.screens.map { toScene($0.frame) }.first { $0.contains(point) }
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
