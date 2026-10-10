import Foundation

// Reads the daemon's server-sent events and hands every snapshot on, on the main queue. When
// the connection drops it reports no sessions and reconnects, waiting longer each time, up to 10 s.
final class EventStream: NSObject, URLSessionDataDelegate {
  private let url: URL
  private let onSnapshot: (Snapshot) -> Void
  private lazy var session = URLSession(configuration: .default, delegate: self, delegateQueue: .main)
  private var buffer = Data()
  private var retryDelay: TimeInterval = 1

  init(url: URL, onSnapshot: @escaping (Snapshot) -> Void) {
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
    retryDelay = 1
    buffer.append(data)
    let separator = Data("\n\n".utf8)
    while let end = buffer.range(of: separator) {
      let block = String(decoding: buffer[buffer.startIndex..<end.lowerBound], as: UTF8.self)
      buffer.removeSubrange(buffer.startIndex..<end.upperBound)
      handle(block)
    }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    print("claudie: disconnected from \(url): \(error?.localizedDescription ?? "closed")")
    onSnapshot(Snapshot(now: Date().timeIntervalSince1970 * 1000, sessions: []))
    let delay = retryDelay
    retryDelay = min(retryDelay * 2, 10)
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in self?.start() }
  }

  // An event block: "event: state" and "data: {…}" lines; ": ping" comments are skipped.
  private func handle(_ block: String) {
    var event = "message"
    var data = ""
    for line in block.split(separator: "\n") {
      if line.hasPrefix("event: ") {
        event = String(line.dropFirst(7))
      } else if line.hasPrefix("data: ") {
        data += line.dropFirst(6)
      }
    }
    guard event == "state" else { return }
    do {
      onSnapshot(try JSONDecoder().decode(Snapshot.self, from: Data(data.utf8)))
    } catch {
      print("claudie: bad snapshot: \(error)")
    }
  }
}
