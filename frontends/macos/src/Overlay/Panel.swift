import AppKit

// Transparent, above other windows, and never takes the focus from the terminal.
@MainActor
final class Panel: NSPanel {
  var overFullscreen = false { didSet { updateBehavior() } }

  override var canBecomeKey: Bool { false }
  override var canBecomeMain: Bool { false }

  init(contentRect: NSRect) {
    super.init(contentRect: contentRect, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: true)
    level = .statusBar  // above normal windows and the Dock
    backgroundColor = .clear
    isOpaque = false
    hasShadow = false
    ignoresMouseEvents = true
    acceptsMouseMovedEvents = true
    isReleasedWhenClosed = false
    hidesOnDeactivate = false
    updateBehavior()
  }

  required init?(coder: NSCoder) {
    fatalError("not loaded from a nib")
  }

  // Without fullScreenAuxiliary the panel stays out of fullscreen apps' spaces. `.transient`
  // hides it in Mission Control; `.stationary` would keep it there.
  private func updateBehavior() {
    var behavior: NSWindow.CollectionBehavior = [.canJoinAllSpaces, .transient, .ignoresCycle]
    if overFullscreen { behavior.insert(.fullScreenAuxiliary) }
    collectionBehavior = behavior
  }
}
