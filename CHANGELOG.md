<!--
Entries for 1.0.2 through 1.0.4 were reconstructed after the fact: those
versions were tagged while no changelog plugin was configured, and the history
around them was rebased, so they are grouped by release rather than pinned
precisely to each tag.
-->

## [2.0.0](https://github.com/JoshPiper/deployment-for-gmodstore/compare/v1.0.4...v2.0.0) (2026-08-22)


### ⚠ BREAKING CHANGES

* the action now runs on the node24 runtime, which requires a runner new enough to provide it. Self-hosted runners may need updating.
* the type input no longer defaults to stable, so a workflow supplying a pre-release version without an explicit type now resolves the release type from the version string rather than always publishing to stable. version: "1.2.3-beta" with no type previously uploaded the name "1.2.3-beta" to stable, and now uploads the name "1.2.3" to beta. Pass type explicitly, or infer-type: false, to keep the previous behaviour.

### Bug Fixes

* fail the action when an error response cannot be decoded ([#359](https://github.com/JoshPiper/deployment-for-gmodstore/issues/359)) ([46e1fa5](https://github.com/JoshPiper/deployment-for-gmodstore/commit/46e1fa5ce50f8daf37e89bf4f1e32258e93352b4))


### Build System

* rebuild the build system on esbuild, targeting node 24 ([#361](https://github.com/JoshPiper/deployment-for-gmodstore/issues/361)) ([60863bd](https://github.com/JoshPiper/deployment-for-gmodstore/commit/60863bd4b463e2b475dd11c2afb3f73ac0fb9e47))


### Code Refactoring

* stop defaulting type, and rename release-type internals and inputs ([#360](https://github.com/JoshPiper/deployment-for-gmodstore/issues/360)) ([0965456](https://github.com/JoshPiper/deployment-for-gmodstore/commit/096545689282356d3e66584ea431ed0f80ee018b))

## [1.0.4](https://github.com/JoshPiper/deployment-for-gmodstore/compare/v1.0.3...v1.0.4) (2025-09-23)


### Bug Fixes

* Explicitly catch and exit from errors in the main function. ([830fa44](https://github.com/JoshPiper/deployment-for-gmodstore/commit/830fa44))
* Remove orphaned form data declaration. ([5f2672d](https://github.com/JoshPiper/deployment-for-gmodstore/commit/5f2672d))


### Build System

* Run a full package update. ([a5592b4](https://github.com/JoshPiper/deployment-for-gmodstore/commit/a5592b4))



## [1.0.3](https://github.com/JoshPiper/deployment-for-gmodstore/compare/v1.0.2...v1.0.3) (2023-10-05)


### Bug Fixes

* Don't follow redirects. ([d23d20a](https://github.com/JoshPiper/deployment-for-gmodstore/commit/d23d20a))



## [1.0.2](https://github.com/JoshPiper/deployment-for-gmodstore/compare/v1.0.1...v1.0.2) (2023-10-05)


### Bug Fixes

* Correct the default base URL. ([c17e725](https://github.com/JoshPiper/deployment-for-gmodstore/commit/c17e725))


### Build System

* Build from TypeScript automatically during release. ([#67](https://github.com/JoshPiper/deployment-for-gmodstore/issues/67))



## [1.0.1](https://github.com//JoshPiper/GModStore-Deployment/compare/v1.0.0...v1.0.1) (2023-07-23)


### Bug Fixes

* Corrected API Route. ([167d55e](https://github.com//JoshPiper/GModStore-Deployment/commit/167d55e3eb29c53fa45098c711dd29753dc0fcfd))



# [1.0.0](https://github.com//JoshPiper/GModStore-Deployment/compare/v0.7.0...v1.0.0) (2022-12-02)


* GMS API v3 (#53) ([a5df42b](https://github.com//JoshPiper/GModStore-Deployment/commit/a5df42b6276ff38c96a4ab5920dac0050e193c47)), closes [#53](https://github.com//JoshPiper/GModStore-Deployment/issues/53)


### BREAKING CHANGES

* Addon input has been removed, and replaced with Product.



# [0.7.0](https://github.com//JoshPiper/GModStore-Deployment/compare/v0.6.3...v0.7.0) (2022-03-22)


### Features

* Display the error if a json decode error occurs. ([f381693](https://github.com//JoshPiper/GModStore-Deployment/commit/f3816935da8225f1381e14a7c4e47984c7bb4241))



## [0.6.3](https://github.com//JoshPiper/GModStore-Deployment/compare/v0.6.2...v0.6.3) (2021-06-10)


### Bug Fixes

* guard against an invalid json response. ([#24](https://github.com//JoshPiper/GModStore-Deployment/issues/24)) ([a1272c2](https://github.com//JoshPiper/GModStore-Deployment/commit/a1272c20bfcf052f9798db95c1e16a0220441ab1))



## [0.6.2](https://github.com//JoshPiper/GModStore-Deployment/compare/v0.6.1...v0.6.2) (2021-05-04)


### Bug Fixes

* Fixed Version-Type error. ([#19](https://github.com//JoshPiper/GModStore-Deployment/issues/19)) ([9e1eca0](https://github.com//JoshPiper/GModStore-Deployment/commit/9e1eca0bd8a278cf507d6d8eec9bef471f29a40b))
