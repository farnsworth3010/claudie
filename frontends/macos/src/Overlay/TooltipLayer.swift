import AppKit
import QuartzCore

// The tooltip's box and text, measured again only when the text changes.
@MainActor
final class TooltipLayer {
  let layer = CALayer()
  private let label = CATextLayer()
  private var current: Tooltip?
  private var size = CGSize.zero

  init() {
    layer.backgroundColor = Config.TooltipStyle.background
    layer.cornerRadius = Config.TooltipStyle.cornerRadius
    layer.isHidden = true
    layer.addSublayer(label)
  }

  // Centred over its anchor, in scene coordinates (y down); nil when there is none.
  private var centredRect: CGRect? {
    current.map { CGRect(x: $0.x - size.width / 2, y: $0.y - size.height, width: size.width, height: size.height) }
  }

  // Where the tooltip stands, pushed back inside `bounds`: centred over a Clawd at the screen's edge
  // it would stick out past it.
  func sceneRect(within bounds: CGRect?) -> CGRect? {
    guard let rect = centredRect, let bounds else { return centredRect }
    let x = min(max(rect.minX, bounds.minX), bounds.maxX - rect.width)
    let y = min(max(rect.minY, bounds.minY), bounds.maxY - rect.height)
    return CGRect(origin: CGPoint(x: x, y: y), size: rect.size)
  }

  func update(_ tooltip: Tooltip?, scale: CGFloat) {
    if let text = tooltip?.text, text != current?.text { measure(text, scale: scale) }
    current = tooltip
  }

  private func measure(_ string: String, scale: CGFloat) {
    let style = Config.TooltipStyle.self
    let text = NSAttributedString(string: string, attributes: [.font: NSFont.systemFont(ofSize: style.fontSize), .foregroundColor: NSColor.white])
    let measured = text.boundingRect(with: style.maxTextSize, options: [.usesLineFragmentOrigin]).size
    let textSize = CGSize(width: ceil(measured.width), height: ceil(measured.height))
    size = CGSize(width: textSize.width + style.padding.width * 2, height: textSize.height + style.padding.height * 2)
    label.string = text
    label.frame = CGRect(origin: CGPoint(x: style.padding.width, y: style.padding.height), size: textSize)
    label.contentsScale = scale
  }
}
