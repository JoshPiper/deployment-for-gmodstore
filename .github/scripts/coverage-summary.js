#!/usr/bin/env node
/**
 * Render coverage/coverage-summary.json into the workflow job summary.
 * Silently does nothing outside Actions, or when the run produced no coverage.
 */
const {readFileSync, appendFileSync, existsSync} = require("node:fs")
const {join, relative, sep} = require("node:path")

const SUMMARY = join(process.cwd(), "coverage", "coverage-summary.json")
const output = process.env.GITHUB_STEP_SUMMARY

if (output === undefined || !existsSync(SUMMARY)){
	process.exit(0)
}

const report = JSON.parse(readFileSync(SUMMARY, "utf8"))
const metrics = ["lines", "statements", "branches", "functions"]

const cell = metric => {
	const {pct, covered, total} = metric
	return `${pct.toFixed(2)}% (${covered}/${total})`
}

const rows = [
	`### Coverage (Node ${process.version})`,
	"",
	`| File | ${metrics.map(name => name[0].toUpperCase() + name.slice(1)).join(" | ")} |`,
	`| --- | ${metrics.map(() => "---").join(" | ")} |`
]

const files = Object.keys(report).filter(key => key !== "total").sort()
for (const file of [...files, "total"]){
	const label = file === "total" ? "**Total**" : `\`${relative(process.cwd(), file).split(sep).join("/")}\``
	rows.push(`| ${label} | ${metrics.map(name => cell(report[file][name])).join(" | ")} |`)
}

appendFileSync(output, `${rows.join("\n")}\n`)
