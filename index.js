const core = require("@actions/core")
const fetch = require("node-fetch")
const FormData = require("form-data")
const fs = require("fs")

const versionReg = /(.*?)-(stable|beta|alpha|private|demo)$/gi

function getVersion(version){
	const result = versionReg.exec(version)
	if (result !== null) {
		return [result[1], result[2]]
	} else {
		return [version, inpOrFail("type", "stable")]
	}
}

function inpOrFail(input, def = null){
	let variable = core.getInput(input)
	if (!variable){
		if (def !== null){
			return def
		} else {
			throw new Error(`Failed to get input ${input}`)
		}
	}
	return variable
}

async function main(){
	let product, token, version, path, type, changelog, baseurl
	try {
		product = inpOrFail("product")
		token = inpOrFail("token");
		[version, type] = getVersion(inpOrFail("version"))
		path = inpOrFail("path")
		if (!path.endsWith(".zip")){
			throw new Error("Input path must refer to a .zip file")
		}
		changelog = inpOrFail("changelog", "No changelog.")
		baseurl = inpOrFail("baseurl", "https://gmodstore.com/api/v3/")
	} catch (err){
		core.setFailed(`An error occured during input processing.\n${err}`)
		return
	}

	let size
	try {
		size = (await fs.promises.stat(path)).size
	} catch (err){
		core.setFailed(`An error occured whilst detecting input file size.\n${err}`)
		return
	}

	let newVersion = new FormData()
	newVersion.append("name", version)
	newVersion.append("changelog", changelog)
	newVersion.append("file", fs.readFileSync(path), {
		filepath: path,
		contentType: "application/zip",
		knownLength: size
	})
	newVersion.append("releaseType", type)

	let response = await fetch(`${baseurl}products/${product}/versions`, {
		method: "POST",
		body: newVersion,
		redirect: 'follow',
		headers: {
			"Authorization": `Bearer ${token}`
		}
	})

	if (response.status < 200 || response.status >= 300){
		let body
		try {
			body = await response.json()
		} catch (e){
			core.warning("An error occured whilst decoding the JSON response.")
			core.warning("This shouldn't normally happen, and suggests an issue with the API itself.")
			core.error(e)
			return
		}

		core.setFailed(`An error occured during upload, with HTTP code ${response.status} and message "${body.message}".`)
		if (body.errors){
			for (let id of Object.keys(body.errors)){
				let errs = body.errors[id]
				let leng = errs.length
				if (leng === 1){
					core.error(`An error occured in the ${id} field`)
				} else {
					core.error(`Errors occured in the ${id} field`)
				}
				for (let i = 0; i < leng; i++){
					core.error(errs[i])
				}
			}
		}
	}
}
main()
