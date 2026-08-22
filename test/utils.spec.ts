import {beforeEach, describe, expect, it, vi} from "vitest"
import {setInputs, thrownBy} from "./helpers/actions"

const PRODUCT = "46529d74-df19-4297-865f-6d11b6a787fd"

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
	it("returns the supplied token", () => {
		setInputs({token: "gms_secret"})
		expect(utils.getToken()).toBe("gms_secret")
	})

	it("trims surrounding whitespace", () => {
		setInputs({token: "  gms_secret\n"})
		expect(utils.getToken()).toBe("gms_secret")
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
		expect(thrownBy(() => utils.getProduct())).toBe("Input 'product' is not a valid UUID.")
	})

	it("rejects a UUID with a bad version nibble", () => {
		setInputs({product: "46529d74-df19-9297-865f-6d11b6a787fd"})
		expect(thrownBy(() => utils.getProduct())).toBe("Input 'product' is not a valid UUID.")
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
		expect(thrownBy(() => utils.getReleaseType()))
			.toBe("Input 'type' must be one of demo, stable, beta, alpha, private, got \"gamma\"")
	})
})

describe("getPath", () => {
	it("accepts a zip path", () => {
		setInputs({path: "build/addon.zip"})
		expect(utils.getPath()).toBe("build/addon.zip")
	})

	it("rejects a non-zip path", () => {
		setInputs({path: "build/addon.tar.gz"})
		expect(thrownBy(() => utils.getPath())).toBe("Input path must end in .zip")
	})

	// Documents current behaviour: the suffix check is case sensitive, so an
	// uppercase extension from a Windows build step is rejected.
	it("rejects an uppercase .ZIP extension", () => {
		setInputs({path: "build/ADDON.ZIP"})
		expect(thrownBy(() => utils.getPath())).toBe("Input path must end in .zip")
	})

	it("rejects a missing path", () => {
		expect(() => utils.getPath()).toThrow("Input required and not supplied: path")
	})
})

describe("getChangelog", () => {
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
		setInputs({dryrun: value})
		expect(utils.isDryRun()).toBe(true)
	})

	it("is false for false", () => {
		setInputs({dryrun: "false"})
		expect(utils.isDryRun()).toBe(false)
	})

	// Documents current behaviour: only the literal string "true" enables it.
	it("is false for 1", () => {
		setInputs({dryrun: "1"})
		expect(utils.isDryRun()).toBe(false)
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
			expect(thrownBy(() => utils.effectiveNameAndType())).toBeTypeOf("string")
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

		// KNOWN BUG: the legacy pattern is case insensitive but returns the raw
		// match, so the release type reaches the API in the caller's casing.
		// Flip this to it() once effectiveNameAndType lowercases the match.
		it.fails("lowercases a suffix matched case insensitively", () => {
			setInputs({version: "build_42-BETA"})
			expect(utils.effectiveNameAndType()).toEqual(["build_42", "beta"])
		})
	})

	describe("with intuition disabled", () => {
		it("keeps the version and defaults the type to stable", () => {
			setInputs({version: "1.2.3-beta", nointuit: "true"})
			expect(utils.effectiveNameAndType()).toEqual(["1.2.3-beta", "stable"])
		})

		it("still honours an explicit type", () => {
			setInputs({version: "1.2.3-beta", nointuit: "true", type: "private"})
			expect(utils.effectiveNameAndType()).toEqual(["1.2.3-beta", "private"])
		})
	})

	// KNOWN BUG: VERSION_REGEX carries the /g flag, so exec() resumes from the
	// previous match and the same input yields a different answer second time.
	// Flip this to it() once the flag is dropped.
	it.fails("is idempotent for a legacy version name", () => {
		setInputs({version: "build_42-beta"})
		const first = utils.effectiveNameAndType()
		const second = utils.effectiveNameAndType()
		expect(second).toEqual(first)
	})
})
