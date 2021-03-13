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
	baseurl = inpOrFail("baseurl", "https://gmodstore.com/api/v6/")
} catch (err){
	core.setFailed(`An error occured during input processing.\n${err}`)
	return
}

let client = ApiClient.instance
client.authentications['bearerAuth'].accessToken = token

let newVersion = new FormData()
newVersion.append("name", version)
newVersion.append("changelog", changelog)
newVersion.append("file", fs.createReadStream(path))
newVersion.append("release_type", type)

let response = await fetch(`${baseurl}/addons/${addon}/versions`, {
	method: "POST",
	body: newVersion
})
console.log(response)

//
// let versions = new AddonVersionsApi()
// versions.createAddonVersion(addon, newVersion, {}, (err, data, response) => {
// 	if (err){
// 		let details = JSON.parse(response.text)
// 		if (details.errors !== undefined){
// 			for (let id of Object.keys(details.errors)){
// 				core.error(details.errors[id][0])
// 			}
// 			core.setFailed("Error(s) occured during upload. See the log for details.")
// 		} else {
// 			core.setFailed(`An error occured during upload.\n${err}`)
// 		}
// 	}
// })
