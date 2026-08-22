import {readFileSync} from "node:fs"
import {join} from "node:path"
import {afterEach, beforeEach, describe, expect, it} from "vitest"
import {main} from "../main"
import {actionFailed, setInputs, WorkflowLog} from "./helpers/actions"
import {type MockGmodStore, startMockApi} from "./helpers/api"

const PRODUCT = "46529d74-df19-4297-865f-6d11b6a787fd"
const ZIP = join(process.cwd(), "test", "test.zip")
const TOKEN = "gms_test_token"

let api: MockGmodStore
let log: WorkflowLog

/** The inputs a real workflow would supply, before any per-test overrides. */
function useInputs(overrides: Record<string, string | undefined> = {}): void {
	setInputs({
		token: TOKEN,
		product: PRODUCT,
		version: "1.2.3",
		path: ZIP,
		changelog: "## 1.2.3\n- Did a thing.",
		baseurl: api.baseUrl,
		...overrides
	})
}

beforeEach(async () => {
	api = await startMockApi()
	log = new WorkflowLog()
	log.start()
})

afterEach(async () => {
	log.stop()
	await api.stop()
})

describe("a successful upload", () => {
	beforeEach(async () => {
		useInputs()
		await main()
	})

	it("posts once to the product versions endpoint", () => {
		expect(api.requests).toHaveLength(1)
		expect(api.lastRequest?.method).toBe("POST")
		expect(api.lastRequest?.url).toBe(`/v3/products/${PRODUCT}/versions`)
	})

	it("authenticates with a bearer token", () => {
		expect(api.lastRequest?.headers.authorization).toBe(`Bearer ${TOKEN}`)
	})

	it("sends a multipart body", () => {
		expect(api.lastRequest?.headers["content-type"]).toMatch(/^multipart\/form-data; boundary=/)
	})

	it("sends exactly the fields the API expects", () => {
		expect(api.lastRequest?.parts.map(part => part.name).sort())
			.toEqual(["changelog", "file", "name", "releaseType"])
	})

	it("sends the version name and release type", () => {
		expect(api.lastRequest?.text("name")).toBe("1.2.3")
		expect(api.lastRequest?.text("releaseType")).toBe("stable")
	})

	// multipart/form-data normalises field newlines to CRLF, so the changelog
	// reaches the API with different line endings than the workflow supplied.
	it("sends the changelog with normalised line endings", () => {
		expect(api.lastRequest?.text("changelog")).toBe("## 1.2.3\r\n- Did a thing.")
	})

	it("sends the zip byte for byte", () => {
		expect(api.lastRequest?.part("file")?.value.equals(readFileSync(ZIP))).toBe(true)
	})

	it("does not fail the action", () => {
		expect(actionFailed()).toBe(false)
		expect(log.errors).toEqual([])
	})
})

describe("input handling", () => {
	it("defaults the changelog when none is given", async () => {
		useInputs({changelog: undefined})
		await main()

		expect(api.lastRequest?.text("changelog")).toBe("No changelog provided.")
	})

	it("intuits the release type from the version and strips the suffix", async () => {
		useInputs({version: "1.2.3-beta"})
		await main()

		expect(api.lastRequest?.text("name")).toBe("1.2.3")
		expect(api.lastRequest?.text("releaseType")).toBe("beta")
	})

	it("keeps a numbered pre-release in the version name", async () => {
		useInputs({version: "1.2.3-alpha.4"})
		await main()

		expect(api.lastRequest?.text("name")).toBe("1.2.3-alpha.4")
		expect(api.lastRequest?.text("releaseType")).toBe("alpha")
	})

	it("lets an explicit type override intuition", async () => {
		useInputs({version: "1.2.3-beta", type: "private"})
		await main()

		expect(api.lastRequest?.text("name")).toBe("1.2.3-beta")
		expect(api.lastRequest?.text("releaseType")).toBe("private")
	})

	it("honours infer-type", async () => {
		useInputs({version: "1.2.3-beta", "infer-type": "false"})
		await main()

		expect(api.lastRequest?.text("name")).toBe("1.2.3-beta")
		expect(api.lastRequest?.text("releaseType")).toBe("stable")
	})

	it("fails without uploading when an input is invalid", async () => {
		useInputs({product: "not-a-uuid"})
		await main()

		expect(api.requests).toHaveLength(0)
		expect(actionFailed()).toBe(true)
		expect(log.errors.join("\n")).toContain("An error occured during input processing.")
	})

	it("fails without uploading when a required input is missing", async () => {
		useInputs({token: undefined})
		await main()

		expect(api.requests).toHaveLength(0)
		expect(actionFailed()).toBe(true)
	})

	it("fails cleanly without uploading when the zip is missing", async () => {
		useInputs({path: join(process.cwd(), "test", "does-not-exist.zip")})
		await main()

		expect(api.requests).toHaveLength(0)
		expect(actionFailed()).toBe(true)
		expect(log.errors.join("\n")).toContain("An error occured during input processing.")
		expect(log.errors.join("\n")).toContain("does not exist")
	})

	it("normalises a base URL that is missing its trailing slash", async () => {
		useInputs({baseurl: api.baseUrl.replace(/\/$/, "")})
		await main()

		expect(api.lastRequest?.url).toBe(`/v3/products/${PRODUCT}/versions`)
	})

	// The full path would leak the runner's directory layout to the API.
	it("sends only the basename as the multipart filename", async () => {
		useInputs()
		await main()

		expect(api.lastRequest?.part("file")?.filename).toBe("test.zip")
	})
})

describe("a dry run", () => {
	it("does not contact the API", async () => {
		useInputs({"dry-run": "true"})
		await main()

		expect(api.requests).toHaveLength(0)
		expect(actionFailed()).toBe(false)
	})

	it("still validates inputs", async () => {
		useInputs({"dry-run": "true", type: "gamma"})
		await main()

		expect(api.requests).toHaveLength(0)
		expect(actionFailed()).toBe(true)
	})

	it("still requires the zip to exist", async () => {
		useInputs({"dry-run": "true", path: join(process.cwd(), "test", "does-not-exist.zip")})
		await main()

		expect(api.requests).toHaveLength(0)
		expect(actionFailed()).toBe(true)
	})
})

describe("deprecated input aliases", () => {
	it("still skips the upload for dryrun, and warns", async () => {
		useInputs({dryrun: "true"})
		await main()

		expect(api.requests).toHaveLength(0)
		expect(actionFailed()).toBe(false)
		expect(log.warnings.some(entry => entry.includes("Input 'dryrun' is deprecated"))).toBe(true)
	})

	it("still disables intuition for nointuit, and warns", async () => {
		useInputs({version: "1.2.3-beta", nointuit: "true"})
		await main()

		expect(api.lastRequest?.text("name")).toBe("1.2.3-beta")
		expect(api.lastRequest?.text("releaseType")).toBe("stable")
		expect(log.warnings.some(entry => entry.includes("Input 'nointuit' is deprecated"))).toBe(true)
	})

	it("uploads without deprecation warnings when the current inputs are used", async () => {
		useInputs({version: "1.2.3-beta", "infer-type": "false", "dry-run": "false"})
		await main()

		expect(api.requests).toHaveLength(1)
		expect(log.warnings.some(entry => entry.includes("deprecated"))).toBe(false)
	})
})

describe("an API error with a JSON body", () => {
	it("fails the action with the status and message", async () => {
		api.willReply({status: 422, body: {message: "Validation failed"}})
		useInputs()
		await main()

		expect(actionFailed()).toBe(true)
		expect(log.errors.join("\n"))
			.toContain(`An error occurred during upload, with HTTP code 422 and message "Validation failed".`)
	})

	it("reports a single field error in the singular", async () => {
		api.willReply({status: 422, body: {message: "Validation failed", errors: {name: ["is too long"]}}})
		useInputs()
		await main()

		expect(log.errors).toContain("An error occurred in the name field")
		expect(log.errors).toContain("is too long")
	})

	it("reports multiple field errors in the plural", async () => {
		api.willReply({
			status: 422,
			body: {message: "Validation failed", errors: {file: ["is not a zip", "is too large"]}}
		})
		useInputs()
		await main()

		expect(log.errors).toContain("Errors occurred in the file field")
		expect(log.errors).toContain("is not a zip")
		expect(log.errors).toContain("is too large")
	})

	it("copes with an error payload that has no field errors", async () => {
		api.willReply({status: 401, body: {message: "Unauthenticated."}})
		useInputs()
		await main()

		expect(actionFailed()).toBe(true)
		expect(log.errors.join("\n")).toContain("HTTP code 401")
	})
})

describe("an API error with a non-JSON body", () => {
	const GATEWAY_ERROR = {status: 502, contentType: "text/html", body: "<h1>Bad Gateway</h1>"}

	it("warns that the response could not be decoded", async () => {
		api.willReply(GATEWAY_ERROR)
		useInputs()
		await main()

		expect(log.warnings.join("\n")).toContain("An error occurred whilst decoding the JSON response.")
	})

	// Regression test for a green deploy which uploaded nothing: an error page
	// from a proxy or CDN used to return without ever calling setFailed.
	it("fails the action", async () => {
		api.willReply(GATEWAY_ERROR)
		useInputs()
		await main()

		expect(actionFailed()).toBe(true)
	})

	it("reports the status code in the failure", async () => {
		api.willReply(GATEWAY_ERROR)
		useInputs()
		await main()

		expect(log.errors.join("\n"))
			.toContain("An error occurred during upload, with HTTP code 502 and an undecodable body.")
	})

	// The body is the only clue to what actually served the error, so it has to
	// reach the log rather than being swallowed with the failed JSON decode.
	it("logs the body it could not decode", async () => {
		api.willReply(GATEWAY_ERROR)
		useInputs()
		await main()

		expect(log.warnings.join("\n")).toContain("The response body was: <h1>Bad Gateway</h1>")
	})

	it("fails on an empty body", async () => {
		api.willReply({status: 502, contentType: "text/html", body: ""})
		useInputs()
		await main()

		expect(actionFailed()).toBe(true)
		expect(log.warnings.join("\n")).toContain("The response body was empty.")
	})

	it("truncates an oversized body", async () => {
		api.willReply({status: 500, contentType: "text/html", body: "x".repeat(1000)})
		useInputs()
		await main()

		expect(actionFailed()).toBe(true)
		expect(log.warnings.join("\n")).toContain("... (1000 bytes total)")
		expect(log.raw).not.toContain("x".repeat(600))
	})

	it("fails on a JSON body which is not an object", async () => {
		api.willReply({status: 503, body: "null"})
		useInputs()
		await main()

		expect(actionFailed()).toBe(true)
		expect(log.warnings.join("\n")).toContain("The API returned a JSON response which was not an object.")
	})

	it("fails on a JSON string body", async () => {
		api.willReply({status: 503, body: '"Service Unavailable"'})
		useInputs()
		await main()

		expect(actionFailed()).toBe(true)
		expect(log.errors.join("\n")).toContain("HTTP code 503")
	})

	it("does not retry the upload", async () => {
		api.willReply(GATEWAY_ERROR)
		useInputs()
		await main()

		expect(api.requests).toHaveLength(1)
	})
})

describe("a successful upload with a non-JSON body", () => {
	it("succeeds without inspecting the body", async () => {
		api.willReply({status: 201, contentType: "text/html", body: "<h1>Created</h1>"})
		useInputs()
		await main()

		expect(actionFailed()).toBe(false)
		expect(log.errors).toEqual([])
		expect(log.warnings).toEqual([])
	})
})

describe("a transport failure", () => {
	it("rejects when the API is unreachable", async () => {
		const {baseUrl} = api
		await api.stop()
		useInputs({baseurl: baseUrl})

		await expect(main()).rejects.toThrow()
	})
})
