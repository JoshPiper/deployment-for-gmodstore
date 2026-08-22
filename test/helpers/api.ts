import {createServer, type IncomingHttpHeaders, type Server, type ServerResponse} from "node:http"
import type {AddressInfo} from "node:net"
import {type MultipartPart, parseMultipart} from "./multipart"

export interface RecordedRequest {
	method: string
	url: string
	headers: IncomingHttpHeaders
	body: Buffer
	/** Parsed multipart body. Empty when the request was not multipart. */
	parts: MultipartPart[]
	part(name: string): MultipartPart | undefined
	text(name: string): string | undefined
}

export interface MockReply {
	status: number
	/** Defaults to application/json. */
	contentType?: string
	/** Objects are JSON encoded; strings are sent verbatim. */
	body?: unknown
}

const CREATED: MockReply = {
	status: 201,
	body: {data: {id: "00000000-0000-0000-0000-0000000000ff", name: "mock"}}
}

/**
 * A stand-in for the GModStore API.
 *
 * Replies are taken from a queue, so a test can script a sequence; once the
 * queue is empty every further request gets a 201. Every request is recorded
 * with its multipart body parsed, so tests can assert on the actual wire
 * format rather than on a mocked fetch.
 */
export class MockGmodStore {
	readonly requests: RecordedRequest[] = []
	private readonly replies: MockReply[] = []
	private server?: Server
	private url?: string

	async start(): Promise<void> {
		this.server = createServer((req, res) => {
			const chunks: Buffer[] = []
			req.on("data", chunk => chunks.push(chunk))
			req.on("end", () => {
				this.record(req.method ?? "", req.url ?? "", req.headers, Buffer.concat(chunks))
				this.reply(res)
			})
		})

		await new Promise<void>(resolve => this.server!.listen(0, "127.0.0.1", resolve))

		const {port} = this.server.address() as AddressInfo
		this.url = `http://127.0.0.1:${port}/v3/`
	}

	async stop(): Promise<void> {
		if (this.server === undefined){
			return
		}

		const server = this.server
		this.server = undefined
		await new Promise<void>((resolve, reject) => {
			server.closeAllConnections()
			server.close(err => err ? reject(err) : resolve())
		})
	}

	/**
	 * Base URL in the shape the action expects, i.e. with a trailing slash.
	 * Survives stop(), so a test can point the action at a dead port.
	 */
	get baseUrl(): string {
		if (this.url === undefined){
			throw new Error("MockGmodStore has never been started.")
		}

		return this.url
	}

	get lastRequest(): RecordedRequest | undefined {
		return this.requests.at(-1)
	}

	/** Queue a reply for the next request. Chainable. */
	willReply(reply: MockReply): this {
		this.replies.push(reply)
		return this
	}

	private record(method: string, url: string, headers: IncomingHttpHeaders, body: Buffer): void {
		const contentType = headers["content-type"] ?? ""
		const parts = contentType.startsWith("multipart/form-data") ? parseMultipart(body, contentType) : []

		this.requests.push({
			method, url, headers, body, parts,
			part(name){
				return parts.find(part => part.name === name)
			},
			text(name){
				return parts.find(part => part.name === name)?.value.toString("utf8")
			}
		})
	}

	private reply(res: ServerResponse): void {
		const {status, contentType, body} = this.replies.shift() ?? CREATED
		const payload = typeof body === "string" ? body : JSON.stringify(body ?? {})

		res.writeHead(status, {"content-type": contentType ?? "application/json"})
		res.end(payload)
	}
}

/** Start a mock API and hand it to the caller, already listening. */
export async function startMockApi(): Promise<MockGmodStore> {
	const api = new MockGmodStore()
	await api.start()
	return api
}
