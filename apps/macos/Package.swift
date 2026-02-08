// swift-tools-version: 6.2
// Package manifest for the EchoAI macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "EchoAI",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "EchoAIIPC", targets: ["EchoAIIPC"]),
        .library(name: "EchoAIDiscovery", targets: ["EchoAIDiscovery"]),
        .executable(name: "EchoAI", targets: ["EchoAI"]),
        .executable(name: "echoai-mac", targets: ["EchoAIMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/EchoAIKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "EchoAIIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "EchoAIDiscovery",
            dependencies: [
                .product(name: "EchoAIKit", package: "EchoAIKit"),
            ],
            path: "Sources/EchoAIDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "EchoAI",
            dependencies: [
                "EchoAIIPC",
                "EchoAIDiscovery",
                .product(name: "EchoAIKit", package: "EchoAIKit"),
                .product(name: "EchoAIChatUI", package: "EchoAIKit"),
                .product(name: "EchoAIProtocol", package: "EchoAIKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/EchoAI.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "EchoAIMacCLI",
            dependencies: [
                "EchoAIDiscovery",
                .product(name: "EchoAIKit", package: "EchoAIKit"),
                .product(name: "EchoAIProtocol", package: "EchoAIKit"),
            ],
            path: "Sources/EchoAIMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "EchoAIIPCTests",
            dependencies: [
                "EchoAIIPC",
                "EchoAI",
                "EchoAIDiscovery",
                .product(name: "EchoAIProtocol", package: "EchoAIKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
