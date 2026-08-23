import {mkdirSync, mkdtempSync, readFileSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {beforeEach, describe, expect, it, vi} from "vitest"
import {setInputs, thrownBy, WorkflowLog} from "./helpers/actions"

const PRODUCT = "46529d74-df19-4297-865f-6d11b6a787fd"
const ZIP = join(process.cwd(), "test", "test.zip")

/**
 * utils holds module-level state (RELEASE_TYPE_REGEX carries lastIndex between
 * calls), so each test gets a freshly imported copy. Without this the suite
 * would be order dependent.
 */
let utils: typeof import("../utils")

beforeEach(async () => {
	vi.resetModules()
	utils = await import("../utils")
})

describe("getToken", () => {
	/**
	 * getToken emits ::add-mask::, so every call is captured: letting it through
	 * would mask the fixture token in a real workflow run of the suite.
	 */
	function maskedBy(fn: () => unknown): string[] {
		const log = new WorkflowLog()
		log.start()
		try {
			fn()
		} finally {
			log.stop()
		}

		return log.messages("add-mask")
	}

	it("returns the supplied token", () => {
		setInputs({token: "gms_secret"})
		maskedBy(() => expect(utils.getToken()).toBe("gms_secret"))
	})

	it("trims surrounding whitespace", () => {
		setInputs({token: "  gms_secret\n"})
		maskedBy(() => expect(utils.getToken()).toBe("gms_secret"))
	})

	it("registers the token as a secret, so it is masked in the log", () => {
		setInputs({token: "gms_secret"})
		expect(maskedBy(() => utils.getToken())).toContain("gms_secret")
	})

	it("masks the trimmed value, which is what the request carries", () => {
		setInputs({token: "  gms_secret\n"})
		expect(maskedBy(() => utils.getToken())).toContain("gms_secret")
	})

	it("rejects a missing token", () => {
		expect(() => utils.getToken()).toThrow("Input required and not supplied: token")
	})
})

describe("getProduct", () => {
	it("accepts a valid UUID", () => {
		setInputs({product: PRODUCT})
		expect(utils.getProduct()).toBe(PRODUCT)
	})

	it("accepts an uppercase UUID", () => {
		setInputs({product: PRODUCT.toUpperCase()})
		expect(utils.getProduct()).toBe(PRODUCT.toUpperCase())
	})

	it("accepts the nil UUID used in the README example", () => {
		setInputs({product: "00000000-0000-0000-0000-000000000000"})
		expect(utils.getProduct()).toBe("00000000-0000-0000-0000-000000000000")
	})

	it("rejects a non-UUID", () => {
		setInputs({product: "12345"})
		const err = thrownBy(() => utils.getProduct())
		expect(err).toBeInstanceOf(utils.InputError)
		expect((err as Error).message).toBe("Input 'product' is not a valid UUID.")
	})

	it("rejects a UUID with a bad version nibble", () => {
		setInputs({product: "46529d74-df19-9297-865f-6d11b6a787fd"})
		const err = thrownBy(() => utils.getProduct())
		expect(err).toBeInstanceOf(utils.InputError)
		expect((err as Error).message).toBe("Input 'product' is not a valid UUID.")
	})

	it("rejects a missing product", () => {
		expect(() => utils.getProduct()).toThrow("Input required and not supplied: product")
	})
})

describe("getVersionName", () => {
	it("returns the supplied version", () => {
		setInputs({version: "1.2.3"})
		expect(utils.getVersionName()).toBe("1.2.3")
	})

	it("rejects a missing version", () => {
		expect(() => utils.getVersionName()).toThrow("Input required and not supplied: version")
	})
})

describe("hasReleaseType", () => {
	it("is false when type is unset", () => {
		expect(utils.hasReleaseType()).toBe(false)
	})

	it("is false when type is empty", () => {
		setInputs({type: ""})
		expect(utils.hasReleaseType()).toBe(false)
	})

	it("is false when type is only whitespace", () => {
		setInputs({type: "   "})
		expect(utils.hasReleaseType()).toBe(false)
	})

	it("is true when type is supplied", () => {
		setInputs({type: "beta"})
		expect(utils.hasReleaseType()).toBe(true)
	})
})

describe("getReleaseType", () => {
	it("defaults to stable when unset", () => {
		expect(utils.getReleaseType()).toBe("stable")
	})

	it.each(["demo", "stable", "beta", "alpha", "private"])("accepts %s", value => {
		setInputs({type: value})
		expect(utils.getReleaseType()).toBe(value)
	})

	it("lowercases the input", () => {
		setInputs({type: "BeTa"})
		expect(utils.getReleaseType()).toBe("beta")
	})

	it("rejects an unknown type", () => {
		setInputs({type: "gamma"})
		const err = thrownBy(() => utils.getReleaseType())
		expect(err).toBeInstanceOf(utils.InputError)
		expect((err as Error).message).toBe("Input 'type' must be one of demo, stable, beta, alpha, private, got \"gamma\"")
	})
})

describe("getPath", () => {
	it("accepts a zip path", () => {
		setInputs({path: ZIP})
		expect(utils.getPath()).toBe(ZIP)
	})

	it("rejects a path which does not exist", () => {
		const missing = join(process.cwd(), "test", "does-not-exist.zip")
		setInputs({path: missing})
		const err = thrownBy(() => utils.getPath())
		expect(err).toBeInstanceOf(utils.InputError)
		expect((err as Error).message).toBe(`Input 'path' does not exist: ${missing}`)
	})

	it("rejects a path which is not a regular file", () => {
		const dir = join(mkdtempSync(join(tmpdir(), "gmodstore-")), "directory.zip")
		mkdirSync(dir)
		try {
			setInputs({path: dir})
			const err = thrownBy(() => utils.getPath())
			expect(err).toBeInstanceOf(utils.InputError)
			expect((err as Error).message).toBe(`Input 'path' is not a file: ${dir}`)
		} finally {
			rmSync(dir, {recursive: true, force: true})
		}
	})

	it("rejects a non-zip path", () => {
		setInputs({path: "build/addon.tar.gz"})
		const err = thrownBy(() => utils.getPath())
		expect(err).toBeInstanceOf(utils.InputError)
		expect((err as Error).message).toBe("Input path must end in .zip")
	})

	// Documents current behaviour: the suffix check is case sensitive, so an
	// uppercase extension from a Windows build step is rejected.
	it("rejects an uppercase .ZIP extension", () => {
		setInputs({path: "build/ADDON.ZIP"})
		const err = thrownBy(() => utils.getPath())
		expect(err).toBeInstanceOf(utils.InputError)
		expect((err as Error).message).toBe("Input path must end in .zip")
	})

	it("rejects a missing path", () => {
		expect(() => utils.getPath()).toThrow("Input required and not supplied: path")
	})
})

/**
 * The fallback lives in utils.ts, not action.yml. A manifest default would
 * always be present, so the empty-string branch below would never run outside
 * the suite and the two strings could drift apart unnoticed.
 */
describe("getChangelog", () => {
	it("is not defaulted by action.yml, so the fallback is reachable", () => {
		const manifest = readFileSync(join(process.cwd(), "action.yml"), "utf8")
		const block = manifest.match(/^ {2}changelog:\n(?: {4}.*\n)*/m)
		expect(block).not.toBeNull()
		expect(block?.[0]).not.toMatch(/^ {4}default:/m)
	})

	it("returns the supplied changelog", () => {
		setInputs({changelog: "## 1.0.0\n- Things"})
		expect(utils.getChangelog()).toBe("## 1.0.0\n- Things")
	})

	it("falls back to a placeholder when unset", () => {
		expect(utils.getChangelog()).toBe("No changelog provided.")
	})

	it("falls back to a placeholder when empty", () => {
		setInputs({changelog: ""})
		expect(utils.getChangelog()).toBe("No changelog provided.")
	})
})

describe("getBaseUrl", () => {
	it("defaults to the live API", () => {
		expect(utils.getBaseUrl().toString()).toBe("https://api.gmodstore.com/v3/")
	})

	it("accepts an override", () => {
		setInputs({baseurl: "http://127.0.0.1:8080/v3/"})
		expect(utils.getBaseUrl().toString()).toBe("http://127.0.0.1:8080/v3/")
	})

	it("appends a missing trailing slash", () => {
		setInputs({baseurl: "http://127.0.0.1:8080/v3"})
		expect(utils.getBaseUrl().toString()).toBe("http://127.0.0.1:8080/v3/")
	})

	it("rejects a malformed URL", () => {
		setInputs({baseurl: "not a url"})
		expect(thrownBy(() => utils.getBaseUrl())).toBeInstanceOf(TypeError)
	})
})

describe("isDryRun", () => {
	it("is false when unset", () => {
		expect(utils.isDryRun()).toBe(false)
	})

	it.each(["true", "TRUE", "True"])("is true for %s", value => {
		setInputs({"dry-run": value})
		expect(utils.isDryRun()).toBe(true)
	})

	it("is false for false", () => {
		setInputs({"dry-run": "false"})
		expect(utils.isDryRun()).toBe(false)
	})

	// Only the literal booleans are recognised; anything else falls back.
	it("is false for an unrecognised value", () => {
		setInputs({"dry-run": "1"})
		expect(utils.isDryRun()).toBe(false)
	})

	it("ignores surrounding whitespace", () => {
		setInputs({"dry-run": "  TRUE  "})
		expect(utils.isDryRun()).toBe(true)
	})
})

describe("shouldInferType", () => {
	it("is true when unset, so intuition is opt-out", () => {
		expect(utils.shouldInferType()).toBe(true)
	})

	it("is false when disabled", () => {
		setInputs({"infer-type": "false"})
		expect(utils.shouldInferType()).toBe(false)
	})

	it.each(["true", "TRUE", "True"])("is true for %s", value => {
		setInputs({"infer-type": value})
		expect(utils.shouldInferType()).toBe(true)
	})

	// Only the literal booleans are recognised; anything else falls back, and
	// this input falls back to enabled rather than disabled.
	it("is true for an unrecognised value", () => {
		setInputs({"infer-type": "yes"})
		expect(utils.shouldInferType()).toBe(true)
	})
})

/**
 * dry-run and infer-type replaced dryrun and nointuit. The old names keep
 * working but warn, and neither carries a default in action.yml: a default
 * would make the old input always present and the warning permanent.
 */
describe("deprecated input aliases", () => {
	/** Capture workflow commands so a test's ::warning:: never annotates a real run. */
	function warningsFrom(fn: () => unknown): string[] {
		const log = new WorkflowLog()
		log.start()
		try {
			fn()
		} finally {
			log.stop()
		}

		return log.warnings
	}

	describe("dryrun", () => {
		it("still enables a dry run", () => {
			setInputs({dryrun: "true"})
			expect(warningsFrom(() => expect(utils.isDryRun()).toBe(true))).toHaveLength(1)
		})

		it("warns once, naming the replacement", () => {
			setInputs({dryrun: "true"})
			const warnings = warningsFrom(() => utils.isDryRun())

			expect(warnings).toHaveLength(1)
			expect(warnings[0]).toContain("Input 'dryrun' is deprecated")
			expect(warnings[0]).toContain("Use 'dry-run' instead.")
		})

		it("warns even when set to false, because the input was still used", () => {
			setInputs({dryrun: "false"})
			expect(warningsFrom(() => expect(utils.isDryRun()).toBe(false))).toHaveLength(1)
		})

		it("stays silent when only the new input is used", () => {
			setInputs({"dry-run": "true"})
			expect(warningsFrom(() => utils.isDryRun())).toEqual([])
		})

		it("stays silent when neither input is used", () => {
			expect(warningsFrom(() => utils.isDryRun())).toEqual([])
		})

		it("loses to dry-run when the two disagree", () => {
			setInputs({"dry-run": "false", dryrun: "true"})
			const warnings = warningsFrom(() => expect(utils.isDryRun()).toBe(false))

			expect(warnings).toHaveLength(2)
			expect(warnings[1]).toBe("Inputs 'dry-run' and 'dryrun' disagree. Using 'dry-run'.")
		})

		it("does not warn about a conflict when the two agree", () => {
			setInputs({"dry-run": "true", dryrun: "true"})
			const warnings = warningsFrom(() => expect(utils.isDryRun()).toBe(true))

			expect(warnings).toHaveLength(1)
			expect(warnings.some(entry => entry.includes("disagree"))).toBe(false)
		})
	})

	describe("nointuit", () => {
		// nointuit was inverted rather than renamed, so the shim flips it.
		it("disables intuition when true", () => {
			setInputs({nointuit: "true"})
			expect(warningsFrom(() => expect(utils.shouldInferType()).toBe(false))).toHaveLength(1)
		})

		it("leaves intuition enabled when false", () => {
			setInputs({nointuit: "false"})
			expect(warningsFrom(() => expect(utils.shouldInferType()).toBe(true))).toHaveLength(1)
		})

		it("warns that the replacement is inverted", () => {
			setInputs({nointuit: "true"})
			const warnings = warningsFrom(() => utils.shouldInferType())

			expect(warnings[0]).toContain("Input 'nointuit' is deprecated")
			expect(warnings[0]).toContain("Use 'infer-type' instead.")
			expect(warnings[0]).toContain("'nointuit: true' is equivalent to 'infer-type: false'")
		})

		it("stays silent when only the new input is used", () => {
			setInputs({"infer-type": "false"})
			expect(warningsFrom(() => utils.shouldInferType())).toEqual([])
		})

		it("stays silent when neither input is used", () => {
			expect(warningsFrom(() => utils.shouldInferType())).toEqual([])
		})

		it("loses to infer-type when the two disagree", () => {
			setInputs({"infer-type": "true", nointuit: "true"})
			const warnings = warningsFrom(() => expect(utils.shouldInferType()).toBe(true))

			expect(warnings).toHaveLength(2)
			expect(warnings[1]).toBe("Inputs 'infer-type' and 'nointuit' disagree. Using 'infer-type'.")
		})

		it("does not warn about a conflict when the two agree", () => {
			setInputs({"infer-type": "false", nointuit: "true"})
			const warnings = warningsFrom(() => expect(utils.shouldInferType()).toBe(false))

			expect(warnings).toHaveLength(1)
			expect(warnings.some(entry => entry.includes("disagree"))).toBe(false)
		})
	})
})

describe("effectiveNameAndType", () => {
	describe("with an explicit type", () => {
		it("uses the type verbatim and leaves the version untouched", () => {
			setInputs({version: "1.2.3-beta", type: "alpha"})
			expect(utils.effectiveNameAndType()).toEqual(["1.2.3-beta", "alpha"])
		})

		it("rejects an invalid type", () => {
			setInputs({version: "1.2.3", type: "gamma"})
			expect(thrownBy(() => utils.effectiveNameAndType())).toBeInstanceOf(utils.InputError)
		})
	})

	describe("intuiting from a semver pre-release", () => {
		it.each([
			["1.2.3-demo", "1.2.3", "demo"],
			["1.2.3-stable", "1.2.3", "stable"],
			["1.2.3-beta", "1.2.3", "beta"],
			["1.2.3-alpha", "1.2.3", "alpha"],
			["1.2.3-private", "1.2.3", "private"]
		])("strips a bare suffix from %s", (version, name, type) => {
			setInputs({version})
			expect(utils.effectiveNameAndType()).toEqual([name, type])
		})

		it("keeps the version intact when the suffix is numbered", () => {
			setInputs({version: "1.2.3-beta.1"})
			expect(utils.effectiveNameAndType()).toEqual(["1.2.3-beta.1", "beta"])
		})

		it("picks the least public suffix when several are present", () => {
			setInputs({version: "1.0.0-alpha.1.beta.2.private.1.demo"})
			expect(utils.effectiveNameAndType()).toEqual(["1.0.0-alpha.1.beta.2.private.1.demo", "private"])
		})

		it("prefers alpha over beta", () => {
			setInputs({version: "1.0.0-beta.1.alpha.2"})
			expect(utils.effectiveNameAndType()).toEqual(["1.0.0-beta.1.alpha.2", "alpha"])
		})

		it("handles adjacent unnumbered suffixes", () => {
			setInputs({version: "1.2.3-beta.alpha"})
			expect(utils.effectiveNameAndType()).toEqual(["1.2.3-beta.alpha", "alpha"])
		})

		it("falls back to stable for a purely numeric pre-release", () => {
			setInputs({version: "1.2.3-1"})
			expect(utils.effectiveNameAndType()).toEqual(["1.2.3-1", "stable"])
		})

		it("falls back to stable for an unrecognised pre-release", () => {
			setInputs({version: "1.2.3-rc.1"})
			expect(utils.effectiveNameAndType()).toEqual(["1.2.3-rc.1", "stable"])
		})

		it("falls back to stable for a plain version", () => {
			setInputs({version: "1.2.3"})
			expect(utils.effectiveNameAndType()).toEqual(["1.2.3", "stable"])
		})

		it("ignores build metadata", () => {
			setInputs({version: "1.2.3+build.5"})
			expect(utils.effectiveNameAndType()).toEqual(["1.2.3+build.5", "stable"])
		})
	})

	describe("intuiting from a non-semver name", () => {
		it("strips a suffix via the legacy pattern", () => {
			setInputs({version: "build_42-beta"})
			expect(utils.effectiveNameAndType()).toEqual(["build_42", "beta"])
		})

		it("leaves an unsuffixed name alone", () => {
			setInputs({version: "nightly build"})
			expect(utils.effectiveNameAndType()).toEqual(["nightly build", "stable"])
		})

		it("lowercases a suffix matched case insensitively", () => {
			setInputs({version: "build_42-BETA"})
			expect(utils.effectiveNameAndType()).toEqual(["build_42", "beta"])
		})
	})

	describe("with intuition disabled", () => {
		it("keeps the version and defaults the type to stable", () => {
			setInputs({version: "1.2.3-beta", "infer-type": "false"})
			expect(utils.effectiveNameAndType()).toEqual(["1.2.3-beta", "stable"])
		})

		it("still honours an explicit type", () => {
			setInputs({version: "1.2.3-beta", "infer-type": "false", type: "private"})
			expect(utils.effectiveNameAndType()).toEqual(["1.2.3-beta", "private"])
		})

		it("is still disabled by the deprecated nointuit input", () => {
			const log = new WorkflowLog()
			setInputs({version: "1.2.3-beta", nointuit: "true"})
			log.start()
			try {
				expect(utils.effectiveNameAndType()).toEqual(["1.2.3-beta", "stable"])
			} finally {
				log.stop()
			}
		})
	})

	it("is idempotent for a legacy version name", () => {
		setInputs({version: "build_42-beta"})
		const first = utils.effectiveNameAndType()
		const second = utils.effectiveNameAndType()
		expect(second).toEqual(first)
	})
})
