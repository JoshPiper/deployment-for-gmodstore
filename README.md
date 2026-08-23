# GModStore Deployment Action

Easily upload an addon build to GmodStore.

## Usage
```yml
- name: Upload
  uses: JoshPiper/deployment-for-gmodstore@v2 # x-release-please-major
  with:
    product: "00000000-0000-0000-0000-000000000000"
    token: "${{ secrets.GMS_TOKEN }}"
    version: "1.0.0"
    path: "addon.zip"
```

> [!WARNING]
> Don't pin this action to `@main`. The bundled `dist/index.js` is only rebuilt
> when a release is cut, so `main` can carry source changes that aren't in the
> bundle that actually executes. Pin to `@v2` for the latest 2.x, `@v2.1` for a
> minor line, or an exact tag like `@v2.1.0`.

## Inputs

| Input     | State                                                                     | Description                                                                                                                                                                             |
|-----------|---------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| token     |                                                                           | Your GmodStore API Token.<br>This token must have versions write permission.                                                                                                            |
| product   |                                                                           | The product ID, found in the product dashboard.                                                                                                                                         |
| path      |                                                                           | Path to zip file to upload.                                                                                                                                                             |
| version   |                                                                           | The new version name to upload.<br>This input is limited to 80 characters.<br>If type is not set, this input is parsed as a SemVer to find a pre-release suffix to use as type instead. |
| type      | No default<br>Enum: ["stable", "beta", "alpha", "private", "demo"]        | Type of version to release.<br>Setting this skips inference entirely. When unset, the type is inferred from `version`, falling back to "stable".                                        |
| changelog | Default: "No changelog provided."                                         | Markdown formatted changelog.                                                                                                                                                           |
| baseurl   | Default: https://api.gmodstore.com/v3/                                    | Base API URL, for mocking or local proxy.                                                                                                                                               |
| dry-run   | Default: FALSE                                                            | If we should dry-run and handle all the prep, but refrain from the actual upload.                                                                                                        |
| infer-type | Default: TRUE                                                            | Infer the `type` input from a pre-release suffix on the `version` input.                                                                                                                |
| dryrun    | *Deprecated*                                                              | Deprecated alias for `dry-run`. Emits a warning when used.                                                                                                                              |
| nointuit  | *Deprecated*                                                              | Deprecated inverse of `infer-type`; `nointuit: true` equals `infer-type: false`. Emits a warning when used.                                                                              |

## Outputs

| Output       | Description                                                                                                                                    |
|--------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| version-id   | The UUID of the created version, taken from the API response. Empty on a dry run, or if the response body could not be read.                   |
| version-name | The version name that was uploaded, after any release type suffix was stripped. Useful when the type was inferred from `version`.               |
| release-type | The release type that was uploaded to, whether it was given in `type` or inferred from `version`.                                               |

```yml
- name: Upload
  id: upload
  uses: JoshPiper/deployment-for-gmodstore@v2 # x-release-please-major
  with:
    product: "00000000-0000-0000-0000-000000000000"
    token: "${{ secrets.GMS_TOKEN }}"
    version: "1.0.0-beta"
    path: "addon.zip"
- name: Announce
  run: echo "Published ${{ steps.upload.outputs.version-name }} to ${{ steps.upload.outputs.release-type }} as ${{ steps.upload.outputs.version-id }}"
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, commands, and how releases
work.
