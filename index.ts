#!/usr/bin/env node

import {main} from "./main"
main().catch(err => {
	console.error(`An unexpected error occured.\n${err}`)
	process.exit(1)
})
