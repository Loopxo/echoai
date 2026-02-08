import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            exclude: [
                "node_modules/**",
                "dist/**",
                "**/*.d.ts",
                "**/*.test.ts",
                "**/*.spec.ts",
            ],
        },
        testTimeout: 10000,
        hookTimeout: 10000,
    },
});
