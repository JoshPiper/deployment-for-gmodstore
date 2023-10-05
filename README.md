# GModStore Deployment Action

Easily upload an addon build to GmodStore.

## Usage
```yml
- name: Upload
  uses: JoshPiper/deployment-for-gmodstore@v1.0.3
  with:
    product: "00000000-0000-0000-0000-000000000000"
    token: "${{ secrets.GMS_TOKEN }}"
    version: "1.0.0"
    path: "addon.zip"
```

## Inputs

| Input     | State                                                                     | Description                                                                                                                                                                             |
|-----------|---------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| token     |                                                                           | Your GmodStore API Token.<br>This token must have versions write permission.                                                                                                            |
| product   |                                                                           | The product ID, found in the product dashboard.                                                                                                                                         |
| path      |                                                                           | Path to zip file to upload.                                                                                                                                                             |
| version   |                                                                           | The new version name to upload.<br>This input is limited to 80 characters.<br>If type is not set, this input is parsed as a SemVer to find a pre-release suffix to use as type instead. |
| type      | Default: "stable"<br>Enum: ["stable", "beta", "alpha", "private", "demo"] | Type of version to release.                                                                                                                                                             |
| changelog | Default: "No changelog provided."                                         | Markdown formatted changelog.                                                                                                                                                           |
| baseurl   | Default: https://api.gmodstore.com/v3/                                    | Base API URL, for mocking or local proxy.                                                                                                                                               |
| dryrun    | Default: FALSE                                                            | If we should dry-run and handle all the prep, but refrain from the actual upload.                                                                                                       |
| nointuit  | Default: FALSE                                                            | Disable attempting to intuit the type field from the version field.                                                                                                                     |

