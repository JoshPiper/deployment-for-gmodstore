const {join} = require("path")
const {readdir} = require("fs").promises
const proc = require("child_process")
const {promisify} = require("util")

const exec = promisify(proc.exec)

exports.preCommit = async ({tag, version}) => {
	process.env["BUILD_TAG"] = tag
	process.env["BUILD_VERSION"] = version
	let basedir = join(__dirname, 'pre-commit')

	let files = await readdir(basedir)
	files = files.map(file => join(basedir, file))
	files = files.map(file => exec(file))
	await Promise.all(files)
}
