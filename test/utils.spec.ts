import {assert} from "chai"
import {effectiveNameVersion, token} from "../utils";

describe('#effectiveNameVersion', () => {
	it('Parses Complex Versions', () => {
		process.env.INPUT_VERSION = "1.0.0-alpha.1.beta.2.private.1.demo"
		let [name, type] = effectiveNameVersion()
		assert.strictEqual(name, "1.0.0-alpha.1.beta.2.private.1.demo")
		assert.strictEqual(type, 'private')
	})
})
