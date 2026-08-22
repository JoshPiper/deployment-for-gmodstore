import {join} from "node:path"
import {beforeEach, describe, expect, it} from "vitest"
import {main} from "../main"
import {actionFailed, setInputs, WorkflowLog} from "./helpers/actions"

/**
 * Smoke test against the real GModStore API.
 *
 * This uploads an actual (private) version, so it is opt in twice over: it
 * needs a token and an explicit GMS_LIVE=1. CI never sets either, which keeps
 * pull requests from publishing anything.
 *
 *   GMS_LIVE=1 GMS_TOKEN=... npm test
 */
const ENABLED = process.env.GMS_LIVE === "1" && (process.env.GMS_TOKEN ?? "") !== ""
const PRODUCT = process.env.GMS_PRODUCT ?? "46529d74-df19-4297-865f-6d11b6a787fd"

describe.skipIf(!ENABLED)("live upload", () => {
	let log: WorkflowLog

	beforeEach(() => {
		log = new WorkflowLog()
		log.start()
	})

	it("uploads a private test version", async () => {
		const stamp = new Date().toISOString()
		const version = `0.0.0-private.${Date.now()}`

		setInputs({
			token: process.env.GMS_TOKEN,
			product: PRODUCT,
			version,
			type: "private",
			path: join(process.cwd(), "test", "test.zip"),
			changelog: `# ${version}\n\nTest upload from deployment-for-gmodstore at ${stamp}.`
		})

		try {
			await main()
			expect(log.errors).toEqual([])
			expect(actionFailed()).toBe(false)
		} finally {
			log.stop()
		}
	})
})
