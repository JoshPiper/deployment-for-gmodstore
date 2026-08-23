# Contributing

> [!IMPORTANT]
> Don't commit `dist/`. It is the bundle GitHub executes, but it is regenerated
> only when a release is cut. A rebuilt bundle in a feature branch conflicts with
> every other open pull request, and will be asked to be taken back out. CI
> builds from source on every push, so your change is already proven to bundle.

Bug fixes are welcome straight as a pull request. For a new input, or a change
to how the action behaves, please open an issue first — it is a small thing to
ask and it beats finding out at review time that the scope was wrong.

You do not need a formal sign-off for most of it. A maintainer replying on the
issue without deferring or closing it is enough to start work on a fix or a
small feature. A major one — a new area of behaviour, or anything that moves the
public interface below — wants an explicit yes before you write the code.

The short version: `npm ci`, make the change, `npm run verify`, open a pull
request.

## Getting Set Up

Node 24 or newer. `.nvmrc` pins it, so `nvm use` picks the right one.

```sh
npm ci
```

Two settings in `.npmrc` look like mistakes and are not:

- `engine-strict=true` — on older Node the build script fails as an unknown
  `.mts` extension rather than as a version problem, which is a confusing way to
  find out.
- `ignore-scripts=true` — nothing here needs an install script. esbuild is the
  only dependency that ships one, and gets its platform binary through an
  optional dependency instead.

## Commands

| Command | Does |
|---------|------|
| `npm run verify` | Everything CI runs: lint, typecheck, tests with coverage, bundle. |
| `npm run build` | Bundle the action into `dist/`. |
| `npm run build:watch` | Rebuild the bundle on change. |
| `npm run clean` | Remove `dist/`. |
| `npm test` | Unit tests. |
| `npm run test:watch` | Unit tests, on change. |
| `npm run test:coverage` | Unit tests, with the coverage thresholds enforced. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |

`npm run verify` is exactly what CI runs. If it passes locally, CI should agree.

## Where Things Live

| Path | What |
|------|------|
| `index.ts` | Entrypoint. Calls `main()` and turns an unhandled rejection into a non-zero exit. |
| `main.ts` | The upload itself: builds the request, sends it, interprets the response. |
| `utils.ts` | Input reading and validation, including release type inference. |
| `action.yml` | Input and output declarations. The public interface — see [Making A Change](#the-public-interface). |
| `test/` | Vitest specs, plus helpers that fake the Actions runtime and a real HTTP server. |
| `scripts/build.mts` | The esbuild bundler. Run by Node directly; there is no build step for the build. |
| `dist/` | Generated at release time. See [Releases](#releases). |

The build and CI helper scripts are TypeScript that Node runs directly, so the
tooling has no build step of its own.

## Making A Change

### The Public Interface

`action.yml` is the public API. Every input, output and default in it is
something a consumer's workflow already depends on, and it is tracked under
semver — so what you do to it decides the prefix your pull request needs:

- Adding an optional input, or a new output, is a feature: `feat:`, minor bump.
- Renaming or removing an input, making an optional one required, or changing a
  default is breaking: `feat!:` or a `BREAKING CHANGE:` footer, and it waits for
  a major.
- Tightening validation or fixing behaviour without moving the contract is
  `fix:`.

Changing an input touches more places than it looks. All of them, in one list:

- `action.yml`, for the declaration.
- `utils.ts`, for the reading and validation.
- A test, or the coverage thresholds will fail you.
- A step in the Dry Run job, in `.github/workflows/test.yml`.
- The input table in `README.md`, which is what consumers actually read.

Nothing is renamed in place. Deprecate instead: keep the old name working as an
alias, warn when it is used, and drop it in the next major. `dryrun` and
`nointuit` are the standing examples — both still work, both warn, and both have
to keep doing so until a major says otherwise.

### Style

Formatting is done by hand, and ESLint is deliberately correctness-only — it has
no stylistic rules, so it will not tell you when you have drifted. Match the file
you are in:

- Tabs, not spaces.
- Double quotes.
- No semicolons.
- `let` over `const`; `prefer-const` is off on purpose.

Please don't add a formatter or stylistic lint rules as part of an unrelated
change.

### Dependencies

Everything is bundled into `dist/`, so a runtime dependency is bundle size and
supply-chain surface for every workflow using the action. Reach for `node:`
built-ins first; if a dependency is still the right answer, say why in the pull
request. There is no approval step for one.

Watch out for `ignore-scripts=true`: a dependency that relies on a postinstall
script will not run it. esbuild gets away with it because its platform binary
arrives through an optional dependency instead.

### Portability

CI runs on `ubuntu-latest`, but consumers can run this action on any runner
GitHub offers. Our test matrix is not the support matrix: use `node:path` rather
than joining path strings, don't assume a POSIX shell, and don't assume
case-sensitive filenames. A Linux-only assumption passes every check here and
then breaks someone's Windows release pipeline.

### Tests

Vitest, in `test/**/*.spec.ts`. Coverage is enforced over `main.ts` and
`utils.ts` — 97% lines, 97% statements, 92% branches, 100% functions — so a new
branch without a test fails CI rather than merely being untidy.

Two helpers exist so you rarely need to mock anything: `test/helpers/actions.ts`
fakes the Actions runtime and captures the workflow commands the action emits,
and `test/helpers/api.ts` stands up a real local HTTP server to assert on what
went over the wire. Prefer them to stubbing `fetch`.

`test/live.spec.ts` uploads a real private version to GModStore and is skipped
unless both `GMS_LIVE=1` and `GMS_TOKEN` are set. You do not need it, and CI
never runs it.

## Commits And Pull Requests

Commits follow [Conventional Commits](https://www.conventionalcommits.org).
release-please reads them to pick the next version and write the changelog, so
the prefix decides what your change does to a release:

| Prefix | Effect |
|--------|--------|
| `feat:` | Minor bump. Listed under Features. |
| `fix:` | Patch bump. Listed under Bug Fixes. |
| `perf:` `revert:` `build:` `docs:` `refactor:` | Patch bump. Each has its own changelog section. |
| `chore:` `style:` `test:` `ci:` | No changelog entry. |
| `feat!:` or a `BREAKING CHANGE:` footer | Major bump. |

Pull requests are squashed, so the pull request title becomes the commit on
`main` — it is the title that needs the prefix, not every commit on your branch.

Two jobs run on a pull request:

- **Unit** — lint, typecheck, tests with coverage, then a bundle to prove the
  action still builds.
- **Dry Run** — builds from your source and runs the action end to end, which is
  the only coverage `action.yml` and the bundle wiring get. It exercises an
  explicit release type, an inferred one, an empty one, the deprecated input
  names, and two cases that are expected to fail.

If you change how the action fails, add a step to the Dry Run job to cover it.
Adding an input has its own checklist, above.

## Releases

Not something a contributor does, but it explains two things you will notice.

release-please opens a release pull request from the commits on `main`. While
that pull request is open, CI rebuilds and commits `dist/` onto its branch and
rehearses a real upload to GModStore, so anything able to fail a release fails
there. Merging it tags the release and moves the floating `v2` and `v2.1` tags
onto the new tag.

So `dist/` is regenerated there and nowhere else, which is why it must not be in
your diff — and why the README warns against pinning `@main`: `main` can carry
source changes that are not yet in the bundle that actually executes.
