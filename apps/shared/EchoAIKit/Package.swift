// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "EchoAIKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "EchoAIProtocol", targets: ["EchoAIProtocol"]),
        .library(name: "EchoAIKit", targets: ["EchoAIKit"]),
        .library(name: "EchoAIChatUI", targets: ["EchoAIChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "EchoAIProtocol",
            path: "Sources/EchoAIProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "EchoAIKit",
            dependencies: [
                "EchoAIProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/EchoAIKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "EchoAIChatUI",
            dependencies: [
                "EchoAIKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/EchoAIChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "EchoAIKitTests",
            dependencies: ["EchoAIKit", "EchoAIChatUI"],
            path: "Tests/EchoAIKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
