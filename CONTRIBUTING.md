# Contributing

> [!IMPORTANT]
> Don't commit `dist/`. It is the bundle GitHub executes, but it is regenerated
> only when a release is cut. A rebuilt bundle in a feature branch conflicts with
> every other open pull request, and a reviewer will ask you to take it back
> out. CI builds from source on every push, so your change is already proven to
> bundle.

Bug fixes are welcome straight as a pull request. For a new input, or a change
to how the action behaves, please open an issue first — it is a small thing to
ask and it beats finding out at review time that the scope was wrong.

You don't need a formal sign-off for most changes. A maintainer replying on the
issue without deferring or closing it is enough to start work on a fix or a
small feature. A major one — a new area of behaviour, or anything that moves
the public interface described below — wants an explicit yes before you write
the code.

The short version: `npm ci`, make the change, `npm run verify`, open a pull
request.

## Getting Set Up

Node 24 or newer. `.nvmrc` pins it, so `nvm use` picks the right one. That is
the Node you develop against; the runner executes the bundle on whatever
`action.yml` declares in `runs.using`, currently `node24` as well. They are two
separate contracts that happen to agree today.

```sh
npm ci
```

Two settings in `.npmrc` look like mistakes and are not:

- `engine-strict=true` — on older Node the build script fails as an unknown
  `.mts` extension rather than as a version problem, which is a confusing way to
  find out.
- `ignore-scripts=true` — nothing here needs an install script. This has
  consequences if you add a dependency; see [Dependencies](#dependencies).

## Commands

| Command | Does |
|---------|------|
| `npm run verify` | Everything the Unit job runs: lint, typecheck, tests with coverage, bundle. |
| `npm run build` | Bundle the action into `dist/`. |
| `npm run build:watch` | Rebuild the bundle on change. |
| `npm run clean` | Remove `dist/`. |
| `npm test` | Unit tests. |
| `npm run test:watch` | Unit tests, on change. |
| `npm run test:coverage` | Unit tests, with the coverage thresholds enforced. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |

`npm run verify` is exactly what the Unit job runs, so if it passes locally that
job should agree. It does not cover the Dry Run job, which only runs in CI.

## Where Things Live

| Path | What |
|------|------|
| `index.ts` | Entrypoint. Calls `main()` and turns an unhandled rejection into a non-zero exit. |
| `main.ts` | The upload itself: builds the request, sends it, interprets the response. |
| `utils.ts` | Input reading and validation, including release type inference. |
| `action.yml` | Input and output declarations. The public interface — see [The Public Interface](#the-public-interface). |
| `test/` | Vitest specs, plus helpers that fake the Actions runtime and a real HTTP server. |
| `scripts/build.mts` | The esbuild bundler. Run by Node directly; there is no build step for the build. |
| `dist/` | Generated at release time. See [Releases](#releases). |

## Making A Change

### The Public Interface

`action.yml` is the public API. Every input, output and default in it is
something a consumer's workflow already depends on, and it is tracked under
semver — so what you do to it decides the prefix your pull request needs:

- Adding an optional input, or a new output, is a feature: `feat:`, minor bump.
- Removing an input, making an optional one required, or changing a default is
  breaking: `feat!:` or a `BREAKING CHANGE:` footer, and it waits for a major.
- Tightening validation or fixing behaviour without moving the contract is
  `fix:`.

Changing an input touches more places than you would expect. All of them, in
one list:

- `action.yml`, for the declaration.
- `utils.ts`, for the reading and validation.
- A test, without which the coverage thresholds will fail you.
- A step in the Dry Run job, in `.github/workflows/test.yml`.
- The input table in `README.md`, which is what consumers actually read.

Nothing is renamed in place — a rename is an alias plus a deprecation, not an
edit. Add the new name, keep the old one working as an alias, warn when it is
used, and let the major drop it. That part ships as a `feat:` like any other
addition; only the removal is breaking. `dryrun` and `nointuit` are the standing
examples — both still work, both warn, and both have to keep doing so until a
major says otherwise.

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

### Failing And Logging

The action reports failures; it does not crash. Anything the caller got wrong
throws `InputError` from `utils.ts`; `main()` catches it and reports the message
through `setFailed`. Anything else reaching that catch is a genuine fault, so its
stack goes to `core.debug` first — an `InputError` has nothing a stack would add,
but a real one might leave no other record. Throw `InputError` for bad input and
let `main()` do the reporting; don't call `process.exit`.

The token is passed to `setSecret` the moment it is read, because the runner
masks only `secrets.*` on its own — a token that arrives from `vars.*`, from an
expression, or as a literal is not masked. Keep it that way, and don't add
logging that echoes it: no request headers, no full request dumps. Response
bodies go through the existing excerpt helper, which caps how much reaches the
log.

### Dependencies

Everything is bundled into `dist/`, so every runtime dependency adds bundle size
and supply-chain surface to every workflow using the action. Reach for `node:`
built-ins first; if a dependency is still the right answer, say why in the pull
request. There is no approval step for adding one.

Watch out for `ignore-scripts=true`: a dependency that relies on a postinstall
script will not get it run. esbuild gets away with it because its platform binary
arrives through an optional dependency instead.

### Portability

CI runs on `ubuntu-latest`, but consumers can run this action on any runner
GitHub offers. Our test matrix is not the support matrix: use `node:path` rather
than joining path strings, don't assume a POSIX shell, and don't assume
case-sensitive filenames. A Linux-only assumption passes every check here and
then breaks someone's Windows release pipeline.

The flip side is that CI cannot exercise the paths you write for other runners.
That is what the ignore comment under [Tests](#tests) is for.

### Tests

Vitest, in `test/**/*.spec.ts`. Coverage is enforced over `main.ts` and
`utils.ts`, taken together rather than per file — 97% lines, 97% statements, 92%
branches, 100% functions — so a new branch without a test fails CI rather than
merely being untidy.

When a line genuinely cannot be covered — a defensive branch, or a platform path
this Linux CI cannot reach — mark it `/* v8 ignore next */`, or wrap a longer run
in `/* v8 ignore start */` and `/* v8 ignore stop */`, and say why in the pull
request. That is the way out; don't lower the thresholds to make a change fit.
Use it sparingly. An ignore comment on code that could have been tested is worse
than a missing test, because it stops anyone noticing.

Two helpers exist so you rarely need to mock anything: `test/helpers/actions.ts`
fakes the Actions runtime and captures the workflow commands the action emits,
and `test/helpers/api.ts` stands up a real local HTTP server to assert on what
went over the wire. Prefer them to stubbing `fetch`.

`test/live.spec.ts` uploads a real private version to GModStore and is skipped
unless both `GMS_LIVE=1` and `GMS_TOKEN` are set. You don't need it, and CI
never runs it.

## Commits And Pull Requests

Commits follow [Conventional Commits](https://www.conventionalcommits.org).
release-please reads them to pick the next version and write the changelog, so
the prefix decides what your change does to a release:

| Prefix | Effect |
|--------|--------|
| `feat:` | Minor bump. Listed under Features. |
| `fix:` | Patch bump. Listed under Bug Fixes. |
| `perf:`, `revert:`, `build:`, `docs:`, `refactor:` | Patch bump. Each has its own changelog section. |
| `chore:`, `style:`, `test:`, `ci:` | No changelog entry. |
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

Both are expected to pass, so treat a red one as something you broke rather than
as background noise. Neither needs a secret — the Dry Run job uses a placeholder
token and uploads nothing — so both run normally on a pull request from a fork.

If you change how the action fails, add a step to the Dry Run job to cover it.
Adding an input has its own checklist, above. There is no way to run that job
locally: `npm run verify` doesn't include it, so expect to push and read the job
log.

## Releases

Not something a contributor does, but the process explains two things you will
notice.

release-please opens a release pull request from the commits on `main`. While
that pull request is open, CI rebuilds and commits `dist/` onto its branch and
rehearses a real upload to GModStore, so anything able to fail a release fails
there. Merging it tags the release and moves the floating `v2` and `v2.1` tags
onto the new tag.

So `dist/` is regenerated there and nowhere else. That is why it must not be in
your diff, and why the `README.md` warns against pinning `@main`: `main` can
carry source changes that are not yet in the bundle that actually executes.
