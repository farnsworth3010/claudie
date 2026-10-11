import AppKit

@MainActor
protocol InputDelegate: AnyObject {
  func updateMouse()
  func pointerDown()
  func pointerDragged()
  func pointerUp()
  func secondaryClicked()
  func scrolled(_ event: NSEvent)
}

@MainActor
final class InputView: NSView {
  weak var delegate: InputDelegate?

  // Once the panel takes the mouse, moves over it reach no event monitor; this notices leaving the Clawd.
  override func updateTrackingAreas() {
    super.updateTrackingAreas()
    trackingAreas.forEach(removeTrackingArea)
    addTrackingArea(NSTrackingArea(rect: .zero, options: [.mouseMoved, .activeAlways, .inVisibleRect], owner: self))
  }

  override func mouseMoved(with event: NSEvent) { delegate?.updateMouse() }
  override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
  override func mouseDown(with event: NSEvent) { delegate?.pointerDown() }
  override func mouseDragged(with event: NSEvent) { delegate?.pointerDragged() }
  override func mouseUp(with event: NSEvent) { delegate?.pointerUp() }
  override func rightMouseDown(with event: NSEvent) { delegate?.secondaryClicked() }
  override func scrollWheel(with event: NSEvent) { delegate?.scrolled(event) }
}
