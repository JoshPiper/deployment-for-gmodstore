/**
 * Render coverage/coverage-summary.json into the workflow job summary.
 * Silently does nothing outside Actions, or when the run produced no coverage.
 *
 * Run directly by Node, which strips the types itself.
 */
import {appendFile, readFile} from "node:fs/promises"
import {join, relative, sep} from "node:path"

interface Metric {
	pct: number
	covered: number
	total: number
}

type FileSummary = Record<"lines" | "statements" | "branches" | "functions", Metric>

const METRICS = ["lines", "statements", "branches", "functions"] as const

const SUMMARY = join(process.cwd(), "coverage", "coverage-summary.json")
const output = process.env.GITHUB_STEP_SUMMARY

if (output !== undefined){
	let raw: string
	try {
		raw = await readFile(SUMMARY, "utf8")
	} catch {
		// No coverage to report, e.g. the test step failed before writing any.
		process.exit(0)
	}

	const report: Record<string, FileSummary> = JSON.parse(raw)

	const cell = ({pct, covered, total}: Metric): string => `${pct.toFixed(2)}% (${covered}/${total})`
	const title = (name: string): string => name[0].toUpperCase() + name.slice(1)

	const rows = [
		`### Coverage (Node ${process.version})`,
		"",
		`| File | ${METRICS.map(title).join(" | ")} |`,
		`| --- | ${METRICS.map(() => "---").join(" | ")} |`
	]

	const files = Object.keys(report).filter(key => key !== "total").sort()
	for (const file of [...files, "total"]){
		const label = file === "total"
			? "**Total**"
			: `\`${relative(process.cwd(), file).split(sep).join("/")}\``

		rows.push(`| ${label} | ${METRICS.map(name => cell(report[file][name])).join(" | ")} |`)
	}

	await appendFile(output, `${rows.join("\n")}\n`)
}
