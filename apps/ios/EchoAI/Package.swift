// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "EchoAI",
    platforms: [
        .iOS(.v18)
    ],
    products: [
        .library(name: "EchoAI", targets: ["EchoAI"])
    ],
    dependencies: [],
    targets: [
        .target(
            name: "EchoAI",
            dependencies: [],
            path: "Sources"
        )
    ]
)
