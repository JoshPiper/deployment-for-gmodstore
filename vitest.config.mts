import {defineConfig} from "vitest/config"

export default defineConfig({
	test: {
		include: ["test/**/*.spec.ts"],
		setupFiles: ["test/setup.ts"],
		environment: "node",
		restoreMocks: true,
		unstubEnvs: true,
		coverage: {
			provider: "v8",
			// index.ts is the process entrypoint: it calls main() on import and
			// exits, so it cannot be imported by a test. It is covered end to
			// end by the dry run job, which runs the built action for real.
			include: ["main.ts", "utils.ts"],
			reporter: ["text", "html", "lcov", "json-summary"],
			reportsDirectory: "coverage",
			thresholds: {
				lines: 97,
				statements: 97,
				branches: 92,
				functions: 100
			}
		}
	}
})
