module.exports = {
	"branches": [
		"main",
		"build/semantic-release"
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
			prepareCmd: 'git commit -am "chore: Prepare ${nextRelease.version}" && git push'
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

					if (commit.type === 'chore'){
						discard = true
					}

					commit.notes.forEach(note => {
						note.title = 'BREAKING CHANGES'
						discard = false
					})

					if (commit.type === 'feat') {
						commit.type = 'Features'
					} else if (commit.type === 'fix') {
						commit.type = 'Bug Fixes'
					} else if (commit.type === 'perf') {
						commit.type = 'Performance Improvements'
					} else if (commit.type === 'revert' || commit.revert) {
						commit.type = 'Reverts'
					} else if (discard) {
						return
					} else if (commit.type === 'docs') {
						commit.type = 'Documentation'
					} else if (commit.type === 'style') {
						commit.type = 'Styles'
					} else if (commit.type === 'refactor') {
						commit.type = 'Code Refactoring'
					} else if (commit.type === 'test' || commit.type === 'tests') {
						commit.type = 'Tests'
					} else if (commit.type === 'build') {
						if (commit.scope === 'dep' || commit.scope === 'deps'){
							commit.type = 'Dependencies'
							commit.scope = ''
						} else if (commit.scope === 'dev-dep' || commit.scope === 'dev-deps'){
							commit.type = 'Dependencies'
							commit.scope = 'development'
						} else {
							commit.type = 'Build System'
						}
					} else if (commit.type === 'ci') {
						commit.type = 'Continuous Integration'
					}

					if (commit.scope === '*') {
						commit.scope = ''
					}

					if (typeof commit.hash === 'string') {
						commit.shortHash = commit.hash.substring(0, 7)
					}

					if (typeof commit.subject === 'string') {
						let url = context.repository
							? `${context.host}/${context.owner}/${context.repository}`
							: context.repoUrl
						if (url) {
							url = `${url}/issues/`
							// Issue URLs.
							commit.subject = commit.subject.replace(/#([0-9]+)/g, (_, issue) => {
								issues.push(issue)
								return `[#${issue}](${url}${issue})`
							})
						}
						if (context.host) {
							// User URLs.
							commit.subject = commit.subject.replace(/\B@([a-z0-9](?:-?[a-z0-9/]){0,38})/g, (_, username) => {
								if (username.includes('/')) {
									return `@${username}`
								}

								return `[@${username}](${context.host}/${username})`
							})
						}
					}

					// remove references that already appear in the subject
					commit.references = commit.references.filter(reference => {
						if (issues.indexOf(reference.issue) === -1) {
							return true
						}

						return false
					})

					return commit
				},
			}
		}],
		["@semantic-release/github", {
			"successComment": false
		}]
	]
}
