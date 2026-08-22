import * as core from "@actions/core"
import fetch, {type Response} from "node-fetch"
import * as fs from "node:fs"
import {
	token as getToken,
	product as getProduct,
	effectiveNameVersion as getVersion,
	path as getPath,
	changelog as getChangelog,
	baseUrl as getBaseUrl,
	dry as isDryRun
} from "./utils";
import {setFailed} from "@actions/core"
import {FormData} from "formdata-node"
// @ts-ignore
import {FormDataEncoder} from "form-data-encoder"
import {Readable} from "stream";

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

async function main(){
	let token, product, version, versionType, path, changelog, baseUrl
	const dry = isDryRun()
	try {
		token = getToken()
		product = getProduct()
		let v = getVersion()
		version = v[0]
		versionType = v[1]
		path = getPath()
		changelog = getChangelog()
		baseUrl = getBaseUrl()
	} catch (err){
		setFailed(`An error occured during input processing.\n${err}`)
		return
	}

	let newVersion = new FormData()
	newVersion.append("name", version)
	newVersion.append("changelog", changelog)
	newVersion.append("file", new Blob([fs.readFileSync(path)]), path)
	newVersion.append("releaseType", versionType)
	let encoder = new FormDataEncoder(newVersion)

	if (!dry){
		console.log(`${baseUrl}products/${product}/versions`)
		let response = await fetch(`${baseUrl}products/${product}/versions`, {
			method: "POST",
			body: Readable.from(encoder),
			headers: {
				"Authorization": `Bearer ${token}`,
				...encoder.headers
			}
		})

		if (response.status < 200 || response.status >= 300){
			await reportFailure(response)
		}
	}
}

export default main
export {main}
