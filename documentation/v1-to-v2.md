# Migrating from v1 to v2

Version 2 of the bsky.rss has many new features over version 1. This guide will help you migrate your existing code to the new version.

Version 2 of bsky.rss introduces queues. Using a queue system allows for more efficient processing of the feeds. Posts will enter a queue before getting send to Bluesky, and if a ratelimit is hit, the post will be requeued and tried again later. This allows for a more reliable and efficient system.

Aditionally, per-version and branch Docker images are now available on the GitHub Container Registry. To use a specific version, simply use the tag `ghcr.io/milanmdev/bsky.rss:vesrion` (replace `version` with the version you want to use, e.g. `2.0.0`). As for branch images, you can use the tag `ghcr.io/milanmdev/bsky.rss:branch-commit` (replace `branch` with the branch you want to use, e.g. `queue` and replace `commit` with the 7-character commit hash). Branch Docker images do not work on the stable (`main`) branch and will usually only be used for version update testing.

## Configuration File

The configuration file has many new options in version 2. Here's the contents of the `config.example.json` showing all of the parameters available:

```js
{
  "string": "$title - $link",
  "publishEmbed": true,
  "embedType": "card",
  "languages": ["en"],
  "ogUserAgent": "",
  "truncate": true,
  "runInterval": 60,
  "dateField": "",
  "publishDate": false,
  "imageField": "",
  "imageAlt": "$title",
  "forceDescriptionEmbed": false,
  "removeDuplicate": false,
  "descriptionClearHTML": false,
  "titleClearHTML": false
}
```

A brief explanation of each parameter can be found in the [README.md](../README.md) file.

## Environment Variables

Nothing about the environment variables system has changed in version 2. You can still use the same environment variables as before.
