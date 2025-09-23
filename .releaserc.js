module.exports = {
	"branches": [
		"main"
	],
	"plugins": [
		["@semantic-release/commit-analyzer", {
			"parserOpts": {
				"headerPattern": /^(\w*)(?:\((.*)\))?: (.*)$/,
				"breakingHeaderPattern": /^(\w*)(?:\((.*)\))?!: (.*)$/
			},
			"releaseRules": [{
				"type": "*!",
				"release": "major"
			}, {
				"type": "build",
				"scope": "*deps",
				"release": "patch"
			}]
		}],
		["@semantic-release/exec", {
			prepareCmd: "npm run build"
		}],
		["@semantic-release/exec", {
			prepareCmd: 'perl -pi -e "s/JoshPiper\\/deployment-for-gmodstore\\@([\\w.]+)?/JoshPiper\\/deployment-for-gmodstore\\@v${nextRelease.version}/g" README.md'
		}],
		["@semantic-release/exec", {
			prepareCmd: 'git commit -am "release(v${nextRelease.version}: Prepare Release" && git push'
		}],
		["@semantic-release/release-notes-generator", {
			"parserOpts": {
				"headerPattern": /^(\w*)(?:\((.*)\))?!?: (.*)$/,
				"breakingHeaderPattern": /^(\w*)(?:\((.*)\))?!: (.*)$/
			},
			"writerOpts": {
				"transform": (commit, context) => {
					let discard = false
					const issues = []
                    let patch = {
                        type: commit.type,
                    }

					if (commit.type === 'chore'){
						discard = true
					}

					patch.notes = commit.notes.map(note => {
                        let out = {...note}
						out.title = 'BREAKING CHANGES'
						discard = false
                        return out
					})

					if (patch.type === 'feat') {
                        patch.type = 'Features'
					} else if (patch.type === 'fix') {
                        patch.type = 'Bug Fixes'
					} else if (patch.type === 'perf') {
                        patch.type = 'Performance Improvements'
					} else if (patch.type === 'revert' || commit.revert) {
                        patch.type = 'Reverts'
					} else if (discard) {
						return
					} else if (patch.type === 'docs') {
                        patch.type = 'Documentation'
					} else if (patch.type === 'style') {
                        patch.type = 'Styles'
					} else if (patch.type === 'refactor') {
                        patch.type = 'Code Refactoring'
					} else if (patch.type === 'test' || patch.type === 'tests') {
                        patch.type = 'Tests'
					} else if (patch.type === 'build') {
						if (commit.scope === 'dep' || commit.scope === 'deps'){
                            patch.type = 'Dependencies'
                            patch.scope = ''
						} else if (commit.scope === 'dev-dep' || commit.scope === 'dev-deps'){
                            patch.type = 'Dependencies'
                            patch.scope = 'development'
						} else {
                            patch.type = 'Build System'
						}
					} else if (patch.type === 'ci') {
                        patch.type = 'Continuous Integration'
					}

					if (commit.scope === '*') {
						commit.scope = ''
					}

					if (typeof commit.hash === 'string') {
                        patch.shortHash = commit.hash.substring(0, 7)
					}

					if (typeof commit.subject === 'string') {
                        patch.subject = commit.subject

						let url = context.repository
							? `${context.host}/${context.owner}/${context.repository}`
							: context.repoUrl
						if (url) {
							url = `${url}/issues/`
							// Issue URLs.
                            patch.subject = patch.subject.replace(/#([0-9]+)/g, (_, issue) => {
								issues.push(issue)
								return `[#${issue}](${url}${issue})`
							})
						}
						if (context.host) {
							// User URLs.
                            patch.subject = patch.subject.replace(/\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g, (_, username) => {
								if (username.includes('/')) {
									return `@${username}`
								}

								return `[@${username}](${context.host}/${username})`
							})
						}
					}

					// remove references that already appear in the subject
                    patch.references = commit.references.filter(reference => {
						if (issues.indexOf(reference.issue) === -1) {
							return true
						}

						return false
					})

					return patch
				},
			}
		}],
		["@semantic-release/github", {
			"successComment": false
		}]
	]
}
