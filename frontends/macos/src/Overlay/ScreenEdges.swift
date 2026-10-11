import AppKit

// Which parts of a screen the Clawds may use besides its visible frame. The panel sits above the
// Dock and the menu bar, so either can be room for them.
struct ScreenEdges: Equatable {
  let overDock: Bool
  let overMenuBar: Bool

  func area(of screen: NSScreen) -> CGRect {
    let frame = screen.frame
    let visible = screen.visibleFrame
    // The Dock may sit at the bottom or a side; the visible frame leaves it out either way.
    let minX = overDock ? frame.minX : visible.minX
    let maxX = overDock ? frame.maxX : visible.maxX
    let minY = overDock ? frame.minY : visible.minY
    let maxY = overMenuBar ? frame.maxY : visible.maxY
    return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
  }
}
