import {getInput, InputOptions} from "@actions/core"
import {validate as validUUID} from "uuid"
import {parse} from "semver"

/**
 * List of version suffixes, ordered in MOST to LEAST public.
 * Demo is accessible to all users.
 * Stable is accessible to all purchasers.
 * Etc
 */
const VERSIONS = ['demo', 'stable', 'beta', 'alpha', 'private'] as const
type Version = typeof VERSIONS[number]
const VERSION_MAP = new Set<Version>(VERSIONS)
const VERSION_REGEX = /(.*?)-(stable|beta|alpha|private|demo)$/gi

const defaultOptions: InputOptions & ((extra: Partial<InputOptions>) => InputOptions) = function (this: Partial<InputOptions>, extra: Partial<InputOptions>): InputOptions {
	return {...this, ...extra}
}
defaultOptions.required = true
defaultOptions.trimWhitespace = true

const optional = defaultOptions({required: false})

export function token(): string {
	return getInput("token", defaultOptions)
}

export function product(): string {
	let pid = getInput("product", defaultOptions)

	if (!validUUID(pid)){
		throw "Input 'product' is not a valid UUID."
	}

	return pid
}

export function version(): string {
	return getInput("version", defaultOptions)
}

export function hasType(): boolean {
	return getInput("type", optional).toLowerCase() !== ""
}

export function type(): Version {
	const type = getInput("type", optional).toLowerCase()
	if (type === ""){
		return "stable"
	} else if (VERSION_MAP.has(<Version>type)) {
		return <Version>type
	}

	throw `Input 'type' must be one of ${[...VERSION_MAP.keys()].join(", ")}, got "${type}"`
}

export function path(): string {
	const path = getInput("path", defaultOptions)
	if (!path.endsWith(".zip")){
		throw "Input path must end in .zip"
	}

	return path
}

export function changelog(): string {
	const log = getInput("changelog", optional)
	if (log === ""){
		return "No changelog provided."
	}

	return log
}

export function baseUrl(): URL {
	let url = getInput("baseurl", optional)
	if (url === ""){
		url = "https://api.gmodstore.com/v3/"
	}

	return new URL(url)
}

export function dry(): boolean {
	return getInput("dryrun", optional).toLowerCase() === "true"
}

/**
 * Set if we should disable intuiting versions, and instead only use the type input.
 */
export function nointuit(): boolean {
	return getInput("nointuit", optional).toLowerCase() === "true"
}

/**
 * Get the effective name and version to upload.
 * First, attempt to parse as semver.
 * If a single, non-numbered, pre-release version is encountered, which is a valid suffix, it is removed and used as the version type.
 * Otherwise, use the legacy regex.
 * Lastly, fall back to type input.
 */
export function effectiveNameVersion(): string[] {
	const intuit = !nointuit()
	const raw = version()

	if (hasType()){
		return [version(), type()]
	}

	if (intuit){
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
			for (const suffix of VERSIONS.toReversed()){
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

		const res = VERSION_REGEX.exec(version())
		if (res !== null){
			return [res[1], res[2]]
		}
	}

	return [version(), type()]
}
