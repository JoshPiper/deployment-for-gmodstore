const core = require("@actions/core")
const fetch = require("node-fetch")
const FormData = require("form-data")
const isnumeric = require("isnumeric")
const fs = require("fs")

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
	let addon, token, version, path, type, changelog, baseurl
	try {
		addon = inpOrFail("addon")
		if (!isnumeric(addon)){
			throw new Error("Input addon was expected to be numeric.")
		}
		token = inpOrFail("token")
		version = inpOrFail("version")
		path = inpOrFail("path")
		if (!path.endsWith(".zip")){
			throw new Error("Input path must refer to a .zip file")
		}
		type = inpOrFail("type", "stable")
		changelog = inpOrFail("changelog", "No changelog.")
		baseurl = inpOrFail("baseurl", "https://api.gmodstore.com/v2/")
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
	newVersion.append("release_type", type)

	let response = await fetch(`${baseurl}addons/${addon}/versions`, {
		method: "POST",
		body: newVersion,
		redirect: 'follow',
		headers: {
			"Authorization": `Bearer ${token}`
		}
	})

	if (response.status < 200 || response.status >= 300){
		let body = await response.json()
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
