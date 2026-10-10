import AppKit
import QuartzCore

// One transparent panel above other windows, just big enough for the Clawds and the tooltip: a
// panel covering the whole screen blacked out full-screen windows in Mission Control. It lets the
// mouse through except over a drawn Clawd, so the desktop stays usable around them.
@MainActor
final class Overlay: NSObject, InputDelegate {
  private let engine: Engine
  private let perform: (Action) -> Void
  private let openSettings: () -> Void
  private let images = ImageCache()
  private let panel = Panel(contentRect: .zero)
  private let input = InputView()
  private let root = CALayer()
  private let tooltip = TooltipLayer()
  private var spriteLayers: [CALayer] = []
  private var link: CADisplayLink?
  private var fast = false
  private var lastTick: CFTimeInterval = 0
  private var dragging = false
  private var clickThrough = false
  private var edges = ScreenEdges(overDock: true, overMenuBar: false)
  private var monitors: [Any] = []

  init(engine: Engine, perform: @escaping (Action) -> Void, openSettings: @escaping () -> Void) {
    self.engine = engine
    self.perform = perform
    self.openSettings = openSettings
    super.init()

    input.delegate = self
    input.layer = root  // layer-hosting: the sprites are plain layers, composited without redrawing the screen
    input.wantsLayer = true
    root.addSublayer(tooltip.layer)
    panel.contentView = input

    rebuild()
    NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
      MainActor.assumeIsolated { self?.rebuild() }
    }
    startTicking()
    installMouseMonitors()
  }

  func tick() {
    lastTick = CACurrentMediaTime()
    // A release swallowed elsewhere (Mission Control, a screen lock) must not leave the panel
    // holding the mouse.
    if dragging && NSEvent.pressedMouseButtons & 1 == 0 { pointerUp() }
    guard let view = engine.tick(pointer()) else { return }
    for action in engine.takeActions() { perform(action) }
    render(view)
    setFast(view.fast)
    updateMouse()
  }

  func pointerDown() {
    dragging = engine.press(pointer())
    tick()
  }

  func pointerDragged() {
    engine.motion(pointer())
    setFast(true)
  }

  func pointerUp() {
    guard dragging else { return }
    dragging = false
    engine.release()
    tick()
  }

  // The panel takes the mouse only over a Clawd, but a right click may land as it moves away.
  func secondaryClicked() {
    if engine.hit(pointer()) { openSettings() }
  }

  // Ctrl+scroll resizes; a wheel notch is one step, a touchpad's points add up to steps.
  func scrolled(_ event: NSEvent) {
    guard event.modifierFlags.contains(.control) else { return }
    var delta = Double(event.scrollingDeltaY)
    if event.isDirectionInvertedFromDevice { delta = -delta }
    if event.hasPreciseScrollingDeltas { delta /= Config.touchpadScrollDivisor }
    engine.zoom(delta)
    tick()
  }

  // Click-through lets the mouse past the Clawds unless ⌥ Option is held; a drag keeps it to the end.
  func updateMouse() {
    let reachable = !clickThrough || NSEvent.modifierFlags.contains(.option)
    let take = dragging || (reachable && engine.hit(pointer()))
    if panel.ignoresMouseEvents == take { panel.ignoresMouseEvents = !take }
  }

  private func pointer() -> CGPoint {
    SceneSpace.current().pointer()
  }

  // At rest a slow timer; while anything moves, the display's refresh (see setFast). The timer
  // still steps in when the refresh stalls: the link follows the screen the panel is on, which a
  // fullscreen app or a sleeping display takes off screen.
  private func startTicking() {
    let timer = Timer(timeInterval: Config.slowTickInterval, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated {
        guard let self else { return }
        if !self.fast || CACurrentMediaTime() - self.lastTick > Config.displayLinkStallThreshold { self.tick() }
      }
    }
    RunLoop.main.add(timer, forMode: .common)
    let link = input.displayLink(target: self, selector: #selector(refresh(_:)))
    link.isPaused = true
    link.add(to: .main, forMode: .common)
    self.link = link
  }

  // The panel must start taking the mouse as soon as the pointer comes over a Clawd.
  private func installMouseMonitors() {
    // flagsChanged: pressing ⌥ over a Clawd with click-through on, without moving the mouse.
    if let monitor = NSEvent.addGlobalMonitorForEvents(matching: [.mouseMoved, .flagsChanged], handler: { [weak self] _ in
      MainActor.assumeIsolated { self?.updateMouse() }
    }) { monitors.append(monitor) }
    if let monitor = NSEvent.addLocalMonitorForEvents(matching: [.mouseMoved, .flagsChanged], handler: { [weak self] event in
      MainActor.assumeIsolated { self?.updateMouse() }
      return event
    }) { monitors.append(monitor) }
  }

  private func rebuild() {
    let space = SceneSpace.current()
    engine.setScreens(NSScreen.screens.enumerated().map { index, screen -> SceneScreen in
      let area = edges.area(of: screen)
      let id = (screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.intValue ?? index
      return SceneScreen(id: id, area: SceneRect(space.toScene(area)))
    })
    tick()
  }

  @objc private func refresh(_ link: CADisplayLink) {
    tick()
  }

  private func setFast(_ on: Bool) {
    guard on != fast else { return }
    fast = on
    link?.isPaused = !on
  }

  private func render(_ view: SceneView) {
    for sprite in view.sprites { images.remember(sprite) }
    guard !view.sprites.isEmpty else {
      panel.orderOut(nil)
      return
    }
    if view.overFullscreen != panel.overFullscreen { panel.overFullscreen = view.overFullscreen }
    clickThrough = view.clickThrough
    let wanted = ScreenEdges(overDock: view.overDock, overMenuBar: view.overMenuBar)
    if wanted != edges {
      edges = wanted
      // Not from inside a render: rebuilding the screens ticks and renders again.
      DispatchQueue.main.async { [weak self] in self?.rebuild() }
    }
    if panel.alphaValue != CGFloat(view.opacity) { panel.alphaValue = CGFloat(view.opacity) }
    tooltip.update(view.tooltip, scale: panel.backingScaleFactor)

    // The panel is the union of the sprites and the tooltip.
    let space = SceneSpace.current()
    var box = view.sprites.reduce(CGRect.null) { $0.union($1.rect) }
    let tipRect = tooltip.sceneRect(within: view.tooltip.flatMap { space.screen(containing: CGPoint(x: $0.x, y: $0.y)) })
    if let tipRect { box = box.union(tipRect) }
    box = box.insetBy(dx: -Config.panelMargin, dy: -Config.panelMargin).integral
    let frame = space.toCocoa(box)

    // Layers sit in the panel's content, where the origin is the panel's bottom-left corner.
    func local(_ sceneRect: CGRect) -> CGRect {
      space.toCocoa(sceneRect).offsetBy(dx: -frame.minX, dy: -frame.minY)
    }
    // Resized inside the transaction, so the hosted layers don't animate to the new bounds.
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    if panel.frame != frame { panel.setFrame(frame, display: false) }
    if !panel.isVisible { panel.orderFrontRegardless() }
    while spriteLayers.count < view.sprites.count {
      let layer = CALayer()
      layer.magnificationFilter = .nearest
      root.insertSublayer(layer, below: tooltip.layer)
      spriteLayers.append(layer)
    }
    for (index, layer) in spriteLayers.enumerated() {
      guard index < view.sprites.count, let found = images.image(for: view.sprites[index]) else {
        layer.isHidden = true
        continue
      }
      let sprite = view.sprites[index]
      layer.isHidden = false
      if layer.name != found.key {
        layer.name = found.key
        layer.contents = found.image
      }
      layer.frame = local(sprite.rect)
      layer.opacity = Float(sprite.opacity)
    }
    if let tipRect {
      tooltip.layer.isHidden = false
      tooltip.layer.frame = local(tipRect)
    } else {
      tooltip.layer.isHidden = true
    }
    CATransaction.commit()
  }
}
