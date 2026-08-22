/**
 * Minimal multipart/form-data parser, used to assert on what the action
 * actually put on the wire. Deliberately independent of the encoder under
 * test, so a bug in form-data-encoder cannot hide behind a matching bug here.
 */

export interface MultipartPart {
	name: string
	filename?: string
	contentType?: string
	value: Buffer
}

const CRLF = "\r\n"

function boundaryOf(contentType: string): string {
	const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)
	if (match === null){
		throw new Error(`No multipart boundary in content-type: ${contentType}`)
	}

	return (match[1] ?? match[2]).trim()
}

export function parseMultipart(body: Buffer, contentType: string): MultipartPart[] {
	const separator = Buffer.from(`${CRLF}--${boundaryOf(contentType)}`)
	// Prefix a CRLF so the opening boundary matches the same separator as the rest.
	const buffer = Buffer.concat([Buffer.from(CRLF), body])
	const parts: MultipartPart[] = []

	let cursor = buffer.indexOf(separator)
	while (cursor !== -1){
		const next = buffer.indexOf(separator, cursor + separator.length)
		if (next === -1){
			break
		}

		const segment = buffer.subarray(cursor + separator.length, next)
		cursor = next

		// The trailing boundary is "--boundary--"; anything else opens a new part.
		if (segment.subarray(0, 2).toString("latin1") === "--"){
			break
		}

		const split = segment.indexOf(`${CRLF}${CRLF}`)
		if (split === -1){
			throw new Error("Malformed multipart segment: no header/body separator.")
		}

		const headers = segment.subarray(0, split).toString("utf8")
		const value = segment.subarray(split + 4)

		const disposition = /content-disposition:([^\r\n]*)/i.exec(headers)
		if (disposition === null){
			throw new Error(`Multipart segment has no Content-Disposition:\n${headers}`)
		}

		const name = /;\s*name="([^"]*)"/i.exec(disposition[1])
		if (name === null){
			throw new Error(`Multipart Content-Disposition has no name: ${disposition[1]}`)
		}

		const filename = /;\s*filename="([^"]*)"/i.exec(disposition[1])
		const type = /content-type:\s*([^\r\n]*)/i.exec(headers)

		parts.push({
			name: name[1],
			filename: filename?.[1],
			contentType: type?.[1].trim(),
			value
		})
	}

	return parts
}
