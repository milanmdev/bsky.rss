let bskyAgent: any = null;
import { BskyAgent, RichText } from "@atproto/api";

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
}: {
  content: string;
  embed?: any;
  languages?: string[];
}) {
  if (!bskyAgent) throw new Error("Bluesky agent not initialized.");

  const bskyText = new RichText({ text: content });
  await bskyText.detectFacets(bskyAgent);

  let embedImage: any = null;
  if (embed && embed.image) {
    embedImage = await bskyAgent.uploadBlob(embed.image, {
      encoding: "image/jpeg",
    });
  }

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
            description: embed.description ? embed.description : "",
            thumb: embed.image ? embedImage.data.blob : undefined,
          },
        }
      : undefined,
    langs: languages,
    createdAt: new Date().toISOString(),
  };

  let post: any;
  try {
    post = await bskyAgent.post(record);
  } catch (e: any) {
    post = { ratelimit: true };
  } finally {
    return post;
  }
}

export default {
  init,
  login,
  post,
};
