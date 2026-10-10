// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "Claudie",
  platforms: [.macOS(.v14)],
  targets: [
    .executableTarget(name: "Claudie", path: "src")
  ]
)
