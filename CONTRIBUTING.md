# Contributing

[To be written]

## Getting Set Up

[To be written]

## Commands

[To be written]

## Where Things Live

| Path | What |
|------|------|
| `index.ts` | Entrypoint. Calls `main()` and turns an unhandled rejection into a non-zero exit. |
| `main.ts` | The upload itself: builds the request, sends it, interprets the response. |
| `utils.ts` | Input reading and validation, including release type inference. |
| `action.yml` | Input and output declarations. Changing an input means changing this and `utils.ts`. |
| `test/` | Vitest specs, plus helpers that fake the Actions runtime and a real HTTP server. |
| `scripts/build.mts` | The esbuild bundler. Run by Node directly; there is no build step for the build. |
| `dist/` | Generated. See below. |

### Don't commit `dist/`

`dist/index.js` is the file GitHub actually executes, because an action runs
straight from the repository with no install step. It is committed, but it is
regenerated **only at release time**, by the release workflow.

So: never include `dist/` in a pull request. A rebuilt bundle in a feature diff
conflicts with every other open pull request and will be asked to be removed. CI
already builds from source on every push to prove your change still bundles.

## Making A Change

[To be written]

## Commits And Pull Requests

[To be written]

## Releases

[To be written]
