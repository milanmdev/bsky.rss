let bskyAgent: any = null;
import { BskyAgent, RichText } from "@atproto/api";
import fetch from 'node-fetch';
import cheerio from 'cheerio';
import sharp from 'sharp';


async function init(service: string) {
  if (bskyAgent) throw new Error("Bluesky agent already initialized.");

  bskyAgent = new BskyAgent({ service });
  return bskyAgent;
}

async function login({
  identifier,
  password,
}: {
  identifier: string;
  password: string;
}) {
  if (!bskyAgent) throw new Error("Bluesky agent not initialized.");

  let loginData = await bskyAgent.login({ identifier, password });
  if (!loginData.success)
    throw new Error("Login failed with error: " + loginData.error);
  return loginData;
}

async function post({
  content,
  embed,
  languages,
  link,
}: {
  content: string;
  embed?: any;
  languages?: string[];
  link?: string
}) {
  if (!bskyAgent) throw new Error("Bluesky agent not initialized.");

  const bskyText = new RichText({ text: content });
  await bskyText.detectFacets(bskyAgent);

  const dom = await fetch(link)
    .then((response) => response.text())
    .then((html) => cheerio.load(html));

  let description = null;
  const description_ = dom('head > meta[property="og:description"]');
  if (description_) {
    description = description_.attr("content");
  }

  let image_url = null;
  const image_url_ = dom('head > meta[property="og:image"]');
  if (image_url_) {
    image_url = image_url_.attr("content");
  }

  if (image_url) {
    const response = await fetch(image_url);
    const buffer = await response.arrayBuffer();
    const imageBuffer = await sharp(buffer)
      .resize(800, null, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 80,
        progressive: true,
      })
      .toBuffer();

    const image = await bskyAgent.uploadBlob(imageBuffer, { encoding: "image/jpeg" });

    const record = {
      $type: "app.bsky.feed.post",
      text: bskyText.text,
      facets: bskyText.facets,
      embed: embed
        ? {
            $type: "app.bsky.embed.external",
            external: {
              uri: embed.uri,
              title: embed.title,
              description: description ? description : "",
              thumb: image.data.blob,
            },
          }
        : undefined,
      langs: languages,
      createdAt: new Date().toISOString(),
    };

    let post = await bskyAgent.post(record);
    return post;
  }
}

export default {
  init,
  login,
  post,
};
