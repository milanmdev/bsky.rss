# bsky.rss

A configurable RSS poster for Bluesky

# Setup

## Docker

Copy this `docker-compose.yml` file to your Docker host and edit the environment variables:

```yml
version: "3"
services:
  bsky-rss:
    restart: always
    image: ghcr.io/milanmdev/bsky.rss
    environment:
      - APP_PASSWORD=
      - INSTANCE_URL=
      - FETCH_URL=
      - IDENTIFIER=
    volumes:
      - /your/data/directory:/build/data
```

You will need to create a mount for `/build/data` to a directory on your host machine. This is where the `config.json` file will be stored.

Refer to the [Environment Variables & Configuration File](#environment-variables--configuration-file) section for more information on the environment variables and how to set up the configuration file.

## Manual

1. Clone the repository

```bash
git clone github.com/milanmdev/bsky.rss
```

2. Install the dependencies

```bash
yarn install
```

3. Create a `.env` file in the root directory of the project and refer to the [Environment Variables & Configuration File](#environment-variables--configuration-file) section to configure the environment variables and the configuration file.

4. Run the bot

```bash
yarn start
```

# Environment Variables & Configuration File

## Environment Variables

Here's an outline of the environment variables:

- `APP_PASSWORD`: The password of the account that will be posting the RSS feed (you can use an account password, but it's recommended to use an app password)
- `INSTANCE_URL`: The URL of your Bluesky instance (if using the official one, use "https://bsky.social")
- `FETCH_URL`: The URL of the RSS feed you want to fetch & post from (e.g. "http://rss.cnn.com/rss/cnn_latest.rss")
- `IDENTIFIER`: The identifier for the account to post from (this can be the email address or the username of the account)

## Configuration File

- If you set up the RSS poster using **Docker**, create the `config.json` file in your data directory that you mounted in the compose file.
- If you set up the RSS poster **manually**, rename the `config.example.json` file in the `data` directory to `config.json`.

Here's an example of the `config.json` file:

```json
{
  "string": "$title - $link",
  "publishEmbed": true,
  "embedType": "card",
  "languages": ["en"],
  "truncate": true,
  "runInterval": 60,
  "dateField": "",
  "imageField": "",
  "forceDescriptionEmbed": false,
  "descriptionClearHTML": false,
  "ogUserAgent": "",
  "imageAlt": "$title",
  "removeDuplicate": false,
  "titleClearHTML": false
}
```

- `string`: The string to post to Bluesky. You can use the following variables in the string:
  - `$title`: The title of the RSS post
  - `$link`: The link to the RSS post
  - `$description`: The description of the RSS post
- `publishEmbed`: Whether to publish the post as an embed or not. If set to `true`, the post will be published as an embed with the title, description (if available), and link to the RSS post.
- `embedType`: Type of embed. If set to `card`, the post will be published with an Open Graph/link card. If set to `image` an image will be uploaded.
- `languages`: The languages to set the posts to. This can be an array of `ISO 639-1` language codes. If not set, it will default to `en`.
- `truncate`: Whether or not to truncate the body of the post if it is over 300 characters. By default, this is set to `true`.
- `runInterval`: The interval (in seconds) to run the RSS poster. By default (and recommended), this is set to `60` seconds.
- `dateField`: The field to use for the date of the RSS post. This can be any field that is available in the RSS feed. If not set, it will default to pubDate and/or date.
- `imageField`: The field to use for fetching the image of the RSS post. This can be any field that is available in the RSS feed. If not set, the poster will fetch the Open Graph data of the URL provided by the RSS post and use the image from there.
- `forceDescriptionEmbed`: Force the description of the embed to be the description of the RSS post (as opposed to using Open Graph data).
- `descriptionClearHTML`: Remove HTML from the description of the Open Graph description and RSS-provided description (to make it more readable).
- `ogUserAgent`: The user agent to use when fetching the Open Graph data of the URL provided by the RSS post. By default, this is set to `bsky.rss/1.0 (Open Graph Scraper)`.
- `imageAlt`: Alt text for the uploaded image if the `embedType` is set to `image`. Can be any variable (+ string) used in the `string` configuration (e.g. `$title`).
- `removeDuplicate`: Instead of using the last date to track which items needs to be published, use a text-based database to track duplicate items.
- `titleClearHTML`: Remove HTML from the title of the post (to make it more readable).

A `docker-compose.yml` file can be found in the root directory as `docker-compose.example.yml`, which you can use to set up the RSS poster using Docker.

# License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.
