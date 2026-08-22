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
 * utils throws bare strings rather than Errors, which expect().toThrow()
 * cannot match on, so tests assert against the thrown value directly.
 */
export function thrownBy(fn: () => unknown): unknown {
	try {
		fn()
	} catch (err){
		return err
	}

	return undefined
}
