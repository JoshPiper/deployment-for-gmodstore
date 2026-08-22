import {getInput, warning, InputOptions} from "@actions/core"
import {validate as validUUID} from "uuid"
import {parse} from "semver"

/**
 * List of release types, ordered in MOST to LEAST public.
 * Demo is accessible to all users.
 * Stable is accessible to all purchasers.
 * Etc
 */
const RELEASE_TYPES = ['demo', 'stable', 'beta', 'alpha', 'private'] as const
type ReleaseType = typeof RELEASE_TYPES[number]
const RELEASE_TYPE_SET = new Set<ReleaseType>(RELEASE_TYPES)
const RELEASE_TYPE_REGEX = /(.*?)-(stable|beta|alpha|private|demo)$/i

const defaultOptions: InputOptions & ((extra: Partial<InputOptions>) => InputOptions) = function (this: Partial<InputOptions>, extra: Partial<InputOptions>): InputOptions {
	return {...this, ...extra}
}
defaultOptions.required = true
defaultOptions.trimWhitespace = true

const optional = defaultOptions({required: false})

/**
 * Parse a boolean input, falling back when it is unset or unrecognised.
 */
function asBool(value: string, fallback: boolean): boolean {
	const normalised = value.trim().toLowerCase()
	if (normalised === "true"){
		return true
	} else if (normalised === "false"){
		return false
	}

	return fallback
}

/**
 * Read a deprecated input, warning if it has been supplied.
 * These inputs must not carry a default in action.yml, as an always-present
 * replacement would permanently shadow the deprecated name.
 */
function legacyInput(name: string, replacement: string, extra: string = ""): string {
	const value = getInput(name, optional)
	if (value !== ""){
		warning(`Input '${name}' is deprecated and will be removed in a future major release. Use '${replacement}' instead.${extra}`)
	}

	return value
}

export function getToken(): string {
	return getInput("token", defaultOptions)
}

export function getProduct(): string {
	let pid = getInput("product", defaultOptions)

	if (!validUUID(pid)){
		throw "Input 'product' is not a valid UUID."
	}

	return pid
}

/**
 * The raw version input, which is uploaded as the version's name.
 */
export function getVersionName(): string {
	return getInput("version", defaultOptions)
}

export function hasReleaseType(): boolean {
	return getInput("type", optional).toLowerCase() !== ""
}

export function getReleaseType(): ReleaseType {
	const type = getInput("type", optional).toLowerCase()
	if (type === ""){
		return "stable"
	} else if (RELEASE_TYPE_SET.has(<ReleaseType>type)) {
		return <ReleaseType>type
	}

	throw `Input 'type' must be one of ${RELEASE_TYPES.join(", ")}, got "${type}"`
}

export function getPath(): string {
	const path = getInput("path", defaultOptions)
	if (!path.endsWith(".zip")){
		throw "Input path must end in .zip"
	}

	return path
}

export function getChangelog(): string {
	const log = getInput("changelog", optional)
	if (log === ""){
		return "No changelog provided."
	}

	return log
}

export function getBaseUrl(): URL {
	let url = getInput("baseurl", optional)
	if (url === ""){
		url = "https://api.gmodstore.com/v3/"
	}

	// Endpoints are resolved relatively against this, and new URL() replaces
	// the final path segment unless the base ends in a slash.
	if (!url.endsWith("/")){
		url += "/"
	}

	return new URL(url)
}

/**
 * Set if we should handle all the prep, but refrain from the actual upload.
 * Accepts the deprecated 'dryrun' input.
 */
export function isDryRun(): boolean {
	const legacy = legacyInput("dryrun", "dry-run")
	const current = getInput("dry-run", optional)

	if (current !== ""){
		if (legacy !== "" && asBool(current, false) !== asBool(legacy, false)){
			warning("Inputs 'dry-run' and 'dryrun' disagree. Using 'dry-run'.")
		}

		return asBool(current, false)
	}

	return asBool(legacy, false)
}

/**
 * Set if we should infer the release type from the version input.
 * Accepts the deprecated 'nointuit' input, which carries the inverse meaning.
 */
export function shouldInferType(): boolean {
	const legacy = legacyInput("nointuit", "infer-type", " Note that the two are inverted: 'nointuit: true' is equivalent to 'infer-type: false'.")
	const current = getInput("infer-type", optional)
	const legacyInfer = !asBool(legacy, false)

	if (current !== ""){
		const infer = asBool(current, true)
		if (legacy !== "" && infer !== legacyInfer){
			warning("Inputs 'infer-type' and 'nointuit' disagree. Using 'infer-type'.")
		}

		return infer
	}

	if (legacy !== ""){
		return legacyInfer
	}

	return true
}

/**
 * Get the effective name and release type to upload.
 * First, attempt to parse as semver.
 * If a single, non-numbered, pre-release version is encountered, which is a valid suffix, it is removed and used as the release type.
 * Otherwise, use the legacy regex.
 * Lastly, fall back to type input.
 */
export function effectiveNameAndType(): [string, ReleaseType] {
	const infer = shouldInferType()
	const raw = getVersionName()

	if (hasReleaseType()){
		return [raw, getReleaseType()]
	}

	if (infer){
		console.log("Intuiting")
		const ver = parse(raw)
		console.log(ver)
		if (ver !== null){
			let last: string | number | null = null
			const parsed = new Map<string, number>()
			for (const value of ver.prerelease){
				if (typeof last === "string"){
					if (typeof value === "number"){
						parsed.set(last, value)
						last = null
					} else {
						parsed.set(last, 0)
						last = null
					}
				}

				if (typeof value === "string"){
					last = value
				}
			}
			if (last){
				parsed.set(last, 0)
			}
			console.log(parsed)
			for (const suffix of RELEASE_TYPES.toReversed()){
				if (parsed.has(suffix)){
					console.log(`has ${suffix}`)
					if (parsed.size !== 1 || parsed.get(suffix) !== 0){
						console.log("returning")
						return [ver.raw, suffix]
					} else {
						ver.prerelease = []
						return [ver.format(), suffix]
					}
				}
			}
		}

		const res = RELEASE_TYPE_REGEX.exec(raw)
		if (res !== null){
			return [res[1], <ReleaseType>res[2].toLowerCase()]
		}
	}

	return [raw, getReleaseType()]
}
