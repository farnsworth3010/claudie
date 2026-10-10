// The daemon's snapshot (backend/core/src/sessions.ts), with only the fields the overlay shows.
struct Snapshot: Decodable {
  let now: Double  // the daemon's clock, ms since the epoch
  let sessions: [Session]
}

struct Session: Decodable {
  let id: String
  let project: String
  let activity: String
  let mood: String
  let tool: String?
}
