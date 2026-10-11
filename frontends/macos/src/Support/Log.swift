import Foundation

func log(_ message: String) {
  FileHandle.standardError.write(Data("claudie: \(message)\n".utf8))
}
