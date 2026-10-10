import Foundation

// Where the daemon listens and what the app sends it.
struct DaemonClient {
  let pageURL: URL  // the settings page
  let eventsURL: URL
  private let settingsURL: URL

  init() {
    let port = ProcessInfo.processInfo.environment[Config.portEnvironmentVariable] ?? Config.defaultPort
    guard let base = URL(string: "http://127.0.0.1:\(port)") else {
      fatalError("bad \(Config.portEnvironmentVariable) \(port)")
    }
    pageURL = base
    eventsURL = base.appendingPathComponent("events")
    settingsURL = base.appendingPathComponent("settings")
  }

  // `patch` is a JSON object.
  func postSettings(_ patch: Data) {
    var request = URLRequest(url: settingsURL)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = patch
    URLSession.shared.dataTask(with: request) { _, response, error in
      if let error {
        log("POST /settings: \(error.localizedDescription)")
      } else if let http = response as? HTTPURLResponse, http.statusCode != 200 {
        log("POST /settings: HTTP \(http.statusCode)")
      }
    }.resume()
  }
}
