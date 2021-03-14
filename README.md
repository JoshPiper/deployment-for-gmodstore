# GModStore Deployment Action

Easily upload an addon build to GModStore.

## Usage
```yml
- name: Upload
  uses: JoshPiper/GModStore-Deployment@v0.5.0
  with:
    addon: 1000
    token: ${{ secrets.GMS_TOKEN }}
    version: 1.0.5
    path: addon.zip
```

## Inputs

### token
[**Required**] The token input is used to pass your GMS API token.
This token must have versions write permission.

### addon
[**Required**] The addon input is used to pass the addon ID, of the addon to upload to.

### version
[**Required**] The version input takes the new version name. This is limited to 8 characters.

### type
[**Optional, default: "stable", enum: ["stable", "beta", "alpha", "private", "demo"]**] The type input takes the type of version to upload.

### changelog
[**Optional, default: "No changelog."**] The changelog input takes the markdown formatted changelog.

### path
[**Required**] The path input takes the path to the addon. This must be a zip file.

### baseurl
[**Optional, default: "https://api.gmodstore.com/v2/"**] The baseurl path allows overwriting the API's base url, for uploading with a different api version.
