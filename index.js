const core = require("@actions/core")
const {ApiClient, AddonVersionsApi, NewAddonVersion} = require("gmodstore-sdk")
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
		type = inpOrFail("type", "stable")
		changelog = inpOrFail("changelog", "No changelog.")
		baseurl = inpOrFail("baseurl", "https://api.gmodstore.com/v2/")
	} catch (err){
		core.setFailed(`An error occured during input processing.\n${err}`)
		return
	}

	let client = ApiClient.instance
	client.authentications['bearerAuth'].accessToken = token

	let newVersion = new FormData()
	newVersion.append("name", version)
	newVersion.append("changelog", changelog)
	newVersion.append("file", fs.readFileSync(path))
	newVersion.append("release_type", type)

	let response = await fetch(`${baseurl}addons/${addon}/versions`, {
		method: "POST",
		body: newVersion,
		redirect: 'follow',
		headers: {
			"Authorization": `Bearer ${token}`
		}
	})

	console.log(response)
	if (response.status !== 200){
		core.setFailed(`An error occured during upload. Status Code: ${response.status}`)
		let body = response.body.json()
		console.log(body)
	}
}
main()
