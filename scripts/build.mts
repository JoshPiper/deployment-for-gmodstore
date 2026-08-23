/**
 * Bundles the action into dist/index.js.
 *
 * GitHub runs an action straight from the repository, with no install step, so
 * every dependency has to be inlined into a single committed file. esbuild does
 * that; this script wraps it with the two things esbuild does not do by itself:
 * clearing stale output, and collecting the licences of everything it inlined.
 *
 * Run directly by Node, which strips the types itself. There is deliberately no
 * build step for the build.
 */
import {build, context, type BuildOptions, type Metafile, type Plugin} from "esbuild"
import {mkdtemp, readFile, rm, readdir, writeFile} from "node:fs/promises"
import {tmpdir} from "node:os"
import {dirname, join, resolve} from "node:path"
import {fileURLToPath} from "node:url"
import {parseArgs} from "node:util"

const {values} = parseArgs({options: {
	clean: {type: "boolean", default: false},
	watch: {type: "boolean", default: false},
	check: {type: "boolean", default: false}
}})

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Where the bundle is written.
 *
 * dist/ is tracked but only regenerated at release time, so a contributor
 * running the pre-pull-request checks must not be left with it modified: the
 * staged result conflicts with every other open pull request. --check builds
 * into a throwaway directory instead, which proves the bundle still builds
 * without touching the working tree.
 */
const DIST = values.check
	? await mkdtemp(join(tmpdir(), "deployment-for-gmodstore-"))
	: join(ROOT, "dist")
const BUNDLE = join(DIST, "index.js")
const LICENSES = join(DIST, "licenses.txt")

/**
 * Matches action.yml's `runs.using`. Keep the two in step: bundling for a newer
 * runtime than the runner provides fails at the point of deployment, which is
 * the worst place to find out.
 */
const TARGET = "node24"

/**
 * @actions/core statically imports its OIDC client, which drags in
 * @actions/http-client, undici and tunnel: roughly 700kB for an API this action
 * never calls. esbuild cannot drop it on its own because @actions/core does not
 * declare "sideEffects": false, so importing the module is assumed to do
 * something. It does not; the file only declares a class.
 *
 * Saying so here lets esbuild shake it out. This is reachability based, not a
 * stub, so if anything ever does use getIDToken the client comes back on its
 * own. The dry run job runs the built bundle end to end, which is what proves
 * nothing needed was removed.
 */
const MARKER = Symbol("resolved")

const treeShakeHttpClient: Plugin = {
	name: "side-effect-free-http-client",
	setup(build){
		build.onResolve({filter: /^@actions\/http-client/}, async args => {
			if (args.pluginData === MARKER){
				return null
			}

			const resolved = await build.resolve(args.path, {
				kind: args.kind,
				importer: args.importer,
				resolveDir: args.resolveDir,
				pluginData: MARKER
			})

			if (resolved.errors.length > 0){
				return resolved
			}

			return {...resolved, sideEffects: false}
		})
	}
}

const options: BuildOptions = {
	entryPoints: [join(ROOT, "index.ts")],
	outfile: BUNDLE,
	bundle: true,
	platform: "node",
	target: TARGET,
	format: "cjs",
	// The runner reads dist/index.js as the record of what it is about to run,
	// and releases are diffed by eye. Keep it legible rather than small.
	minify: false,
	sourcemap: false,
	legalComments: "none",
	metafile: true,
	logLevel: "info",
	plugins: [treeShakeHttpClient]
}

/** Package directory a bundled input belongs to, or null if it is our own source. */
function packageOf(input: string): string | null {
	const marker = input.lastIndexOf("node_modules/")
	if (marker === -1){
		return null
	}

	const relative = input.slice(marker + "node_modules/".length)
	const segments = relative.split("/")
	// Scoped packages are two segments deep; everything else is one.
	const depth = relative.startsWith("@") ? 2 : 1

	return join(input.slice(0, marker), "node_modules", ...segments.slice(0, depth))
}

const LICENSE_FILES = /^(licen[cs]e|copying|notice)(\.\w+)?$/i

/** The licence text shipped with a package, if it ships one. */
async function licenseText(directory: string): Promise<string | null> {
	let entries: string[]
	try {
		entries = await readdir(directory)
	} catch {
		return null
	}

	const file = entries.find(entry => LICENSE_FILES.test(entry))
	if (file === undefined){
		return null
	}

	return (await readFile(join(directory, file), "utf8")).trim()
}

interface Attribution {
	name: string
	version: string
	license: string
	text: string | null
}

/**
 * Read every package esbuild actually inlined, in dependency name order.
 *
 * Taken from the output's input list rather than the metafile's, so packages
 * that were parsed and then tree shaken away are not credited in a file that
 * claims to describe what shipped.
 */
async function attributions(metafile: Metafile, outfile: string): Promise<Attribution[]> {
	const output = metafile.outputs[outfile]
	if (output === undefined){
		throw new Error(`esbuild reported no output for ${outfile}.`)
	}

	const directories = new Set<string>()
	for (const [input, {bytesInOutput}] of Object.entries(output.inputs)){
		if (bytesInOutput === 0){
			continue
		}

		const directory = packageOf(input)
		if (directory !== null){
			directories.add(directory)
		}
	}

	const collected = await Promise.all([...directories].map(async directory => {
		const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"))
		const license = typeof manifest.license === "string"
			? manifest.license
			: manifest.license?.type ?? "UNKNOWN"

		return {
			name: manifest.name,
			version: manifest.version,
			license,
			text: await licenseText(directory)
		} satisfies Attribution
	}))

	return collected.sort((left, right) => left.name.localeCompare(right.name))
}

/** Write dist/licenses.txt, and report anything we are shipping without terms. */
async function writeLicenses(metafile: Metafile, outfile: string): Promise<void> {
	const packages = await attributions(metafile, outfile)
	const licenses = [...new Set(packages.map(entry => entry.license))].sort()

	const sections = packages.map(entry => [
		`## ${entry.name}@${entry.version}`,
		`License: ${entry.license}`,
		"",
		entry.text ?? `No licence file is distributed with this package; it declares ${entry.license}.`
	].join("\n"))

	const header = [
		"Third party licences for the code bundled into dist/index.js.",
		"Generated by scripts/build.mts; do not edit by hand.",
		"",
		`Bundled packages: ${packages.length}`,
		`Licences in use: ${licenses.join(", ")}`
	].join("\n")

	const document = [header, ...sections].join("\n\n")

	await writeFile(LICENSES, `${document}\n`)

	const unlicensed = packages.filter(entry => entry.license === "UNKNOWN")
	if (unlicensed.length > 0){
		console.warn(`Warning: no licence declared by ${unlicensed.map(entry => entry.name).join(", ")}.`)
	}

	console.log(`  licences  ${packages.length} packages (${licenses.join(", ")})`)
}

async function clean(): Promise<void> {
	await rm(DIST, {recursive: true, force: true})
}

/**
 * Fail the build when action.yml and TARGET have drifted apart.
 *
 * The manifest decides which Node the runner starts, and this script decides
 * which Node the bundle is compiled for. Nothing else connects the two, and a
 * mismatch only shows up when a real workflow runs the action.
 */
async function assertRuntimeMatchesManifest(): Promise<void> {
	const manifest = await readFile(join(ROOT, "action.yml"), "utf8")
	const declared = /^\s*using:\s*["']?(node\d+)["']?/m.exec(manifest)

	if (declared === null){
		throw new Error("action.yml does not name a node runtime in runs.using.")
	}

	if (declared[1] !== TARGET){
		throw new Error(
			`action.yml runs on ${declared[1]} but the bundle targets ${TARGET}. ` +
			"Update TARGET in scripts/build.mts, or runs.using in action.yml."
		)
	}
}

if (values.clean){
	await clean()
	console.log("Removed dist.")
} else if (values.watch){
	// Licences are a release concern, and regenerating them on every keystroke
	// is just latency, so watch mode only rebuilds the bundle.
	const builder = await context({...options, metafile: false})
	await builder.watch()
	console.log("Watching for changes. Press Ctrl+C to stop.")
} else {
	await assertRuntimeMatchesManifest()
	await clean()
	try {
		const result = await build(options)
		if (result.metafile === undefined){
			throw new Error("esbuild produced no metafile, so licences cannot be collected.")
		}

		// esbuild keys outputs by a path relative to the working directory.
		const [outfile] = Object.keys(result.metafile.outputs).filter(key => key.endsWith("index.js"))
		await writeLicenses(result.metafile, outfile)
	} finally {
		if (values.check){
			await rm(DIST, {recursive: true, force: true})
		}
	}
}
