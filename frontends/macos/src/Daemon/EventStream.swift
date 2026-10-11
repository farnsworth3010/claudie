import Foundation

// Reads the daemon's server-sent events and hands the raw JSON of every snapshot on, on the main
// queue. When the connection drops it reports no sessions and reconnects, waiting longer each
// time, up to `Config.Reconnect.maxDelay`.
final class EventStream: NSObject, URLSessionDataDelegate {
  private static let eventPrefix = "event: "
  private static let dataPrefix = "data: "
  private static let stateEvent = "state"

  private let url: URL
  private let onSnapshot: (String) -> Void
  private lazy var session = URLSession(configuration: .default, delegate: self, delegateQueue: .main)
  private var buffer = Data()
  private var retryDelay = Config.Reconnect.initialDelay

  init(url: URL, onSnapshot: @escaping (String) -> Void) {
    self.url = url
    self.onSnapshot = onSnapshot
  }

  func start() {
    buffer = Data()
    var request = URLRequest(url: url)
    request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
    session.dataTask(with: request).resume()
  }

  // Data arrives in arbitrary chunks; an event ends with a blank line.
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    retryDelay = Config.Reconnect.initialDelay
    buffer.append(data)
    let separator = Data("\n\n".utf8)
    while let end = buffer.range(of: separator) {
      let block = String(decoding: buffer[buffer.startIndex..<end.lowerBound], as: UTF8.self)
      buffer.removeSubrange(buffer.startIndex..<end.upperBound)
      handle(block)
    }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    log("disconnected from \(url): \(error?.localizedDescription ?? "closed")")
    onSnapshot("{\"now\":\(Int(Date().timeIntervalSince1970 * 1000)),\"sessions\":[]}")
    let delay = retryDelay
    retryDelay = min(retryDelay * 2, Config.Reconnect.maxDelay)
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in self?.start() }
  }

  // An event block: "event: state" and "data: {…}" lines; ": ping" comments are skipped.
  private func handle(_ block: String) {
    var event = "message"
    var data = ""
    for line in block.split(separator: "\n") {
      if line.hasPrefix(Self.eventPrefix) {
        event = String(line.dropFirst(Self.eventPrefix.count))
      } else if line.hasPrefix(Self.dataPrefix) {
        data += line.dropFirst(Self.dataPrefix.count)
      }
    }
    guard event == Self.stateEvent else { return }
    onSnapshot(data)
  }
}
