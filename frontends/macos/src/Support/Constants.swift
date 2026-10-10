import CoreGraphics
import Foundation

enum Config {
  static let portEnvironmentVariable = "CLAUDIE_PORT"
  static let defaultPort = "47321"
  static let anchorDefaultsKey = "anchor"

  static let slowTickInterval: TimeInterval = 0.05
  // How long the display link may stay silent before the slow timer ticks again.
  static let displayLinkStallThreshold: CFTimeInterval = 0.1

  static let panelMargin: CGFloat = 4
  // A touchpad reports points, a wheel notch reports one step.
  static let touchpadScrollDivisor = 10.0
  static let imageCacheLimit = 4000

  enum Reconnect {
    static let initialDelay: TimeInterval = 1
    static let maxDelay: TimeInterval = 10
  }

  enum TooltipStyle {
    static let fontSize: CGFloat = 12
    static let padding = CGSize(width: 8, height: 4)
    static let cornerRadius: CGFloat = 6
    static let maxTextSize = CGSize(width: 600, height: 400)
    static let background = CGColor(srgbRed: 31 / 255, green: 22 / 255, blue: 17 / 255, alpha: 0.92)
  }
}
