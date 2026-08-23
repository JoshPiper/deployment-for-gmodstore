import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {vi} from "vitest"

const INPUT_PREFIX = "INPUT_"

export type Inputs = Record<string, string | undefined>

/** The environment variable @actions/core reads a given input from. */
export function inputVariable(name: string): string {
	return `${INPUT_PREFIX}${name.replace(/ /g, "_").toUpperCase()}`
}

/** Remove every INPUT_* variable, so tests never inherit each other's state. */
export function clearInputs(): void {
	for (const key of Object.keys(process.env)){
		if (key.startsWith(INPUT_PREFIX)){
			delete process.env[key]
		}
	}
}

/** Set inputs as the runner would. An undefined value unsets the input. */
export function setInputs(inputs: Inputs): void {
	for (const [name, value] of Object.entries(inputs)){
		const key = inputVariable(name)
		if (value === undefined){
			delete process.env[key]
		} else {
			process.env[key] = value
		}
	}
}

export interface WorkflowCommand {
	command: string
	message: string
	properties: Record<string, string>
}

const COMMAND_PATTERN = /^::([\w-]+)(?:\s([^:]*))?::(.*)$/

function unescapeData(value: string): string {
	return value.replace(/%25/g, "%").replace(/%0D/g, "\r").replace(/%0A/g, "\n")
}

function unescapeProperty(value: string): string {
	return unescapeData(value).replace(/%3A/g, ":").replace(/%2C/g, ",")
}

function parseProperties(raw: string | undefined): Record<string, string> {
	if (raw === undefined || raw === ""){
		return {}
	}

	const properties: Record<string, string> = {}
	for (const pair of raw.split(",")){
		const split = pair.indexOf("=")
		if (split !== -1){
			properties[pair.slice(0, split)] = unescapeProperty(pair.slice(split + 1))
		}
	}

	return properties
}

/**
 * Capture the workflow commands (::error::, ::warning::, ...) the action writes
 * to stdout.
 *
 * Output is swallowed rather than forwarded: when the suite runs inside Actions,
 * letting a test's ::error:: through would annotate the real workflow run.
 */
export class WorkflowLog {
	private readonly chunks: string[] = []
	private spy?: ReturnType<typeof vi.spyOn>

	start(): void {
		this.spy = vi.spyOn(process.stdout, "write").mockImplementation(chunk => {
			this.chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"))
			return true
		})
	}

	stop(): void {
		this.spy?.mockRestore()
		this.spy = undefined
	}

	get raw(): string {
		return this.chunks.join("")
	}

	get commands(): WorkflowCommand[] {
		return this.raw.split(/\r?\n/)
			.map(line => COMMAND_PATTERN.exec(line))
			.filter(match => match !== null)
			.map(match => ({
				command: match[1],
				properties: parseProperties(match[2]),
				message: unescapeData(match[3])
			}))
	}

	/** Messages issued under a given command, e.g. "error" or "warning". */
	messages(command: string): string[] {
		return this.commands.filter(entry => entry.command === command).map(entry => entry.message)
	}

	get errors(): string[] {
		return this.messages("error")
	}

	get warnings(): string[] {
		return this.messages("warning")
	}
}

/**
 * Capture the outputs the action sets.
 *
 * Outputs are read back through the file named by GITHUB_OUTPUT, the same way
 * the runner collects them, rather than through the deprecated ::set-output::
 * command @actions/core falls back to when that variable is unset.
 */
export class OutputFile {
	private readonly directory = mkdtempSync(join(tmpdir(), "gms-outputs-"))
	private readonly path = join(this.directory, "outputs.txt")
	private previous?: string

	start(): void {
		this.previous = process.env.GITHUB_OUTPUT
		writeFileSync(this.path, "")
		process.env.GITHUB_OUTPUT = this.path
	}

	stop(): void {
		if (this.previous === undefined){
			delete process.env.GITHUB_OUTPUT
		} else {
			process.env.GITHUB_OUTPUT = this.previous
		}

		rmSync(this.directory, {recursive: true, force: true})
	}

	/**
	 * Every output written so far.
	 *
	 * The file holds heredoc-delimited records: a "name<<delimiter" line, the
	 * value, then the delimiter alone. A repeated name takes its last value,
	 * as the runner does.
	 */
	get all(): Record<string, string> {
		const lines = readFileSync(this.path, "utf8").split(/\r?\n/)
		const outputs: Record<string, string> = {}

		for (let i = 0; i < lines.length; i++){
			const header = /^(.*?)<<(.+)$/.exec(lines[i])
			if (header === null){
				continue
			}

			const [, name, delimiter] = header
			const value: string[] = []
			while (++i < lines.length && lines[i] !== delimiter){
				value.push(lines[i])
			}

			outputs[name] = value.join("\n")
		}

		return outputs
	}

	get(name: string): string | undefined {
		return this.all[name]
	}
}

/**
 * Reset the runner-visible state @actions/core mutates.
 * setFailed sets process.exitCode; left alone it would fail the test process.
 */
export function resetActionState(): void {
	clearInputs()
	process.exitCode = 0
}

/** True when core.setFailed was called, which is what fails a real action run. */
export function actionFailed(): boolean {
	return process.exitCode !== 0
}

/**
 * Run fn and return whatever it threw, or undefined if it did not throw.
 *
 * Lets tests assert against the thrown value directly - its type, its
 * message, or both - rather than only the substring expect().toThrow() matches.
 */
export function thrownBy(fn: () => unknown): unknown {
	try {
		fn()
	} catch (err){
		return err
	}

	return undefined
}
