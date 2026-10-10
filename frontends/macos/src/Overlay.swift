import AppKit

private let tileSize: CGFloat = 56
private let spacing: CGFloat = 80  // room for each tile's label
private let margin: CGFloat = 24

// A transparent panel over the main screen, above other windows, that lets every click through.
// For now each session is a coloured tile with its project and state; the Clawds come later.
@MainActor
final class Overlay {
  private let panel: NSPanel
  private var tiles: [String: Tile] = [:]

  init() {
    let frame = NSScreen.main?.frame ?? .zero
    panel = NSPanel(contentRect: frame, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    panel.level = .statusBar  // above normal windows and the Dock
    panel.backgroundColor = .clear
    panel.isOpaque = false
    panel.hasShadow = false
    panel.ignoresMouseEvents = true
    // On every Space, not moved by Mission Control, skipped by Cmd+`.
    panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
    let view = NSView(frame: NSRect(origin: .zero, size: frame.size))
    view.wantsLayer = true
    panel.contentView = view
    panel.orderFrontRegardless()
  }

  func show(_ snapshot: Snapshot) {
    guard let root = panel.contentView?.layer, let screen = panel.screen ?? NSScreen.main else { return }
    let ids = Set(snapshot.sessions.map(\.id))
    for (id, tile) in tiles where !ids.contains(id) {
      tile.layer.removeFromSuperlayer()
      tiles[id] = nil
    }

    // A row in the bottom-right corner of the area the Dock and the menu bar leave free. The view's
    // origin is its bottom-left corner, and the panel covers the whole screen.
    let free = screen.visibleFrame.offsetBy(dx: -panel.frame.minX, dy: -panel.frame.minY)
    var x = free.maxX - margin - tileSize - CGFloat(snapshot.sessions.count - 1) * (tileSize + spacing)
    for session in snapshot.sessions {
      let tile = tiles[session.id] ?? Tile(in: root)
      tiles[session.id] = tile
      tile.show(session, at: CGRect(x: x, y: free.minY + margin, width: tileSize, height: tileSize))
      x += tileSize + spacing
    }
  }
}

// One session: a rounded square coloured by what it is doing, with a label above it.
@MainActor
private final class Tile {
  let layer = CALayer()
  private let square = CALayer()
  private let label = CATextLayer()

  init(in root: CALayer) {
    square.cornerRadius = 10
    label.font = NSFont.systemFont(ofSize: 11)
    label.fontSize = 11
    label.alignmentMode = .center
    label.isWrapped = true
    label.foregroundColor = NSColor.white.cgColor
    label.backgroundColor = NSColor.black.withAlphaComponent(0.6).cgColor
    label.cornerRadius = 4
    label.contentsScale = NSScreen.main?.backingScaleFactor ?? 2
    layer.addSublayer(square)
    layer.addSublayer(label)
    root.addSublayer(layer)
  }

  func show(_ session: Session, at frame: CGRect) {
    layer.frame = frame
    square.frame = layer.bounds
    square.backgroundColor = color(of: session.activity).cgColor
    var state = session.activity
    if let tool = session.tool { state += " · \(tool)" }
    if session.mood != "none" { state += " · \(session.mood)" }
    label.string = "\(session.project)\n\(state)"
    label.frame = CGRect(x: -(spacing - 8) / 2, y: frame.height + 4, width: frame.width + spacing - 8, height: 30)
  }

  private func color(of activity: String) -> NSColor {
    switch activity {
    case "thinking": return .systemBlue
    case "working": return .systemGreen
    case "waiting": return .systemOrange
    case "asking": return .systemPurple
    case "compacting": return .systemTeal
    case "delegating": return .systemYellow
    default: return .systemGray  // idle
    }
  }
}
