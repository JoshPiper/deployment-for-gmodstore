import * as core from "@actions/core"
import fetch from "node-fetch"
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

	FormData

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
			redirect: 'follow',
			headers: {
				"Authorization": `Bearer ${token}`,
				...encoder.headers
			}
		})

		if (response.status < 200 || response.status >= 300){
			let body
			try {
				body = await response.json()
			} catch (e){
				core.warning("An error occurred whilst decoding the JSON response.")
				core.warning("This shouldn't normally happen, and suggests an issue with the API itself.")
				if (e instanceof Error || typeof e === "string"){
					core.error(e)
				}

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
	}
}

export default main
export {main}
