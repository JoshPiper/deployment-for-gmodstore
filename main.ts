import * as core from "@actions/core"
import * as fs from "node:fs"
import {basename} from "node:path"
import {
	getToken,
	getProduct,
	effectiveNameAndType,
	getPath,
	getChangelog,
	getBaseUrl,
	isDryRun,
	InputError
} from "./utils";
import {setFailed} from "@actions/core"

/** How much of an undecodable response body to put in the workflow log. */
const BODY_LOG_LIMIT = 500

/** A decoded error payload. Both fields are optional: the API owns this shape. */
interface ErrorBody {
	message?: string
	errors?: Record<string, string[]>
}

/** Log the underlying cause of a decode failure, when it is loggable. */
function logCause(err: unknown): void {
	if (err instanceof Error || typeof err === "string"){
		core.error(err)
	}
}

/** The response body, trimmed to something a workflow log can reasonably carry. */
function excerpt(raw: string): string {
	const body = raw.trim()
	if (body.length <= BODY_LOG_LIMIT){
		return body
	}

	return `${body.slice(0, BODY_LOG_LIMIT)}... (${body.length} bytes total)`
}

/**
 * Decode the body of a non-2xx response, or undefined if it cannot be decoded.
 *
 * The body is read as text and parsed by hand rather than through
 * response.json(), so that an undecodable body - typically an HTML error page
 * served by a proxy or CDN during an outage - can still be shown in the log.
 */
async function decodeErrorBody(response: Response): Promise<ErrorBody | undefined> {
	let raw: string
	try {
		raw = await response.text()
	} catch (err){
		core.warning("An error occurred whilst reading the response body.")
		logCause(err)
		return undefined
	}

	let body: unknown
	try {
		body = JSON.parse(raw)
	} catch (err){
		core.warning("An error occurred whilst decoding the JSON response.")
		core.warning("This shouldn't normally happen, and suggests an issue with the API itself.")
		logCause(err)
		core.warning(raw.trim() === "" ? "The response body was empty." : `The response body was: ${excerpt(raw)}`)
		return undefined
	}

	if (typeof body !== "object" || body === null){
		core.warning("The API returned a JSON response which was not an object.")
		core.warning(`The response body was: ${excerpt(raw)}`)
		return undefined
	}

	return body as ErrorBody
}

/**
 * Report a failed upload to the workflow.
 *
 * Every path out of here calls setFailed: an upload which did not happen must
 * never leave the job green, however unreadable the API's response was.
 */
async function reportFailure(response: Response): Promise<void> {
	const body = await decodeErrorBody(response)
	if (body === undefined){
		core.setFailed(`An error occurred during upload, with HTTP code ${response.status} and an undecodable body.`)
		return
	}

	core.setFailed(`An error occurred during upload, with HTTP code ${response.status} and message "${body.message}".`)
	if (body.errors){
		for (let id of Object.keys(body.errors)){
			let errs = body.errors[id]
			let leng = errs.length
			if (leng === 1){
				core.error(`An error occurred in the ${id} field`)
			} else {
				core.error(`Errors occurred in the ${id} field`)
			}
			for (let i = 0; i < leng; i++){
				core.error(errs[i])
			}
		}
	}
}

/**
 * The created version, as far as the success response could be read.
 * Every field is optional: an unreadable body must not fail the action.
 */
interface CreatedVersion {
	id?: string
	name?: string
	releaseType?: string
}

/** The value if it is a string, otherwise undefined. */
function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined
}

/**
 * Decode the body of a 2xx response, or undefined if it cannot be read.
 *
 * This is the mirror image of decodeErrorBody, and takes the opposite view of
 * a body it cannot parse: the upload has already happened, so nothing in here
 * may fail or even warn. A bad body costs the outputs their API-supplied
 * values and nothing else, so the reason goes to the debug log.
 */
async function decodeCreatedVersion(response: Response): Promise<CreatedVersion | undefined> {
	let body: unknown
	try {
		body = JSON.parse(await response.text())
	} catch (err){
		core.debug(`The successful response body could not be decoded: ${err}`)
		return undefined
	}

	const data: unknown = typeof body === "object" && body !== null ? (body as {data?: unknown}).data : undefined
	if (typeof data !== "object" || data === null){
		core.debug("The successful response body carried no version object.")
		return undefined
	}

	const version = data as Record<string, unknown>
	return {
		id: asString(version.id),
		name: asString(version.name),
		releaseType: asString(version.releaseType)
	}
}

/** Publish what was uploaded, for downstream steps to reference. */
function setOutputs(id: string, name: string, releaseType: string): void {
	core.setOutput("version-id", id)
	core.setOutput("version-name", name)
	core.setOutput("release-type", releaseType)
}

/**
 * Report a successful upload to the workflow.
 *
 * The API is the authority on what was actually created, so its values win
 * where the response gave any; the resolved inputs stand in where it did not.
 */
async function reportSuccess(response: Response, versionName: string, releaseType: string): Promise<void> {
	const created = await decodeCreatedVersion(response) ?? {}
	const name = created.name ?? versionName
	const type = created.releaseType ?? releaseType

	core.info(`Uploaded version "${name}" as a ${type} release.`)
	if (created.id !== undefined){
		core.info(`Version ID: ${created.id}`)
	}

	setOutputs(created.id ?? "", name, type)
}

async function main(){
	let token, product, versionName, releaseType, path, archive, changelog, baseUrl
	const dry = isDryRun()
	try {
		token = getToken()
		product = getProduct()
		const resolved = effectiveNameAndType()
		versionName = resolved[0]
		releaseType = resolved[1]
		path = getPath()
		// Opened here, inside the guard, so an I/O error fails the action the same
		// way a bad input does rather than escaping main() as a stack trace.
		archive = await fs.openAsBlob(path)
		changelog = getChangelog()
		baseUrl = getBaseUrl()
	} catch (err){
		if (err instanceof InputError){
			setFailed(`An error occurred during input processing.\n${err.message}`)
		} else {
			// Only a genuine fault reaches here: an InputError carries nothing a
			// stack would add, but this might be the only record of one that does.
			if (err instanceof Error && err.stack){
				core.debug(err.stack)
			}
			setFailed(`An error occurred during input processing.\n${err}`)
		}
		return
	}

	let newVersion = new FormData()
	newVersion.append("name", versionName)
	newVersion.append("changelog", changelog)
	newVersion.append("file", archive, basename(path))
	newVersion.append("releaseType", releaseType)

	if (!dry){
 		const endpoint = new URL(`products/${product}/versions`, baseUrl)
       		 core.info(endpoint.toString())

		// No content-type header: fetch derives it from the FormData, and
		// setting it by hand would drop the multipart boundary.
		let response = await fetch(endpoint, {
			method: "POST",
			body: newVersion,
			headers: {
				"Authorization": `Bearer ${token}`
			}
		})

		if (response.status < 200 || response.status >= 300){
			await reportFailure(response)
			return
		}

		await reportSuccess(response, versionName, releaseType)
	} else {
		// Nothing was created, so there is no ID to report, but the resolved
		// name and type are exactly what a dry run exists to confirm.
		core.info(`Dry run: would upload version "${versionName}" as a ${releaseType} release.`)
		setOutputs("", versionName, releaseType)
	}
}

export default main
export {main}
