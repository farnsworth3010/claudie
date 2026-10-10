import CoreGraphics
import Foundation

// Sprite frames by id (their pixels arrive once) and the images drawn from them per palette.
@MainActor
final class ImageCache {
  private var frames: [Int: [UInt8]] = [:]
  private var images: [String: CGImage] = [:]
  private let space = CGColorSpace(name: CGColorSpace.sRGB)!

  func remember(_ sprite: SpriteDraw) {
    if let pixels = sprite.pixels { frames[sprite.id] = pixels }
  }

  func image(for sprite: SpriteDraw) -> (key: String, image: CGImage)? {
    let key = "\(sprite.id)|\(sprite.palette)"
    if let image = images[key] { return (key: key, image: image) }
    guard let pixels = frames[sprite.id] else { return nil }
    let colors = sprite.palette.split(separator: ",", omittingEmptySubsequences: false).map { RGB(css: $0) }
    var rgba = [UInt8](repeating: 0, count: pixels.count * 4)
    for (i, slot) in pixels.enumerated() {
      guard Int(slot) < colors.count, let c = colors[Int(slot)] else { continue }
      rgba[i * 4] = c.r
      rgba[i * 4 + 1] = c.g
      rgba[i * 4 + 2] = c.b
      rgba[i * 4 + 3] = 255
    }
    guard let provider = CGDataProvider(data: Data(rgba) as CFData),
      let image = CGImage(
        width: sprite.w, height: sprite.h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: sprite.w * 4,
        space: space, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
        provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
    else { return nil }
    if images.count > Config.imageCacheLimit { images.removeAll() }
    images[key] = image
    return (key: key, image: image)
  }
}

struct RGB {
  let r: UInt8
  let g: UInt8
  let b: UInt8

  // '#rrggbb'; anything else ('transparent') draws nothing.
  init?(css: Substring) {
    guard css.hasPrefix("#"), css.count == 7, let v = UInt32(css.dropFirst(), radix: 16) else { return nil }
    r = UInt8(v >> 16 & 0xff)
    g = UInt8(v >> 8 & 0xff)
    b = UInt8(v & 0xff)
  }
}
