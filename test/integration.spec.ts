import { join } from "path"
import main from "../main"

describe('Integration', () => {
	it('Uploads the Test Folder', async () => {
		process.env['INPUT_PRODUCT'] = "46529d74-df19-4297-865f-6d11b6a787fd"
		process.env['INPUT_TOKEN'] = process.env['GMS_TOKEN']
		process.env['INPUT_VERSION'] = `v1.0.0-private+test:${(new Date().getTime())}`
		process.env['INPUT_TYPE'] = 'private'
		process.env['INPUT_PATH'] = join(__dirname, "test.zip")
		process.env['INPUT_CHANGELOG'] = `
		# Version ${process.env['INPUT_VERSION']}
		
		Test Upload from deployment-for-gmodstore.
		Uploaded At: ${(new Date()).toString()} 
		`
		await main()
	})
})
