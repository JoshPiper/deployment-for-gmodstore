import {afterEach, beforeEach, vi} from "vitest"
import {resetActionState} from "./helpers/actions"

// The action logs debug chatter to the console on every run. Silence it so the
// test report stays readable; assertions use the captured workflow commands.
beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {})
	resetActionState()
})

afterEach(() => {
	vi.restoreAllMocks()
	resetActionState()
})
