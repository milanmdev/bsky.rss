import {
  BskyAgent,
  RichText,
  AtpSessionEvent,
  AtpSessionData,
} from "@atproto/api";
let bskyAgent: BskyAgent | null;
import { XRPCError, ResponseType } from "@atproto/xrpc";
import db from "./dbHandler";

async function init(service: string) {
  if (bskyAgent) throw new Error("Bluesky agent already initialized.");

  bskyAgent = new BskyAgent({
    service,
    // @ts-ignore
    persistSession: (evt: AtpSessionEvent, sess?: AtpSessionData) => {
      if (!sess) return;
      db.writePersistDate(sess);
    },
  });
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
  let persistedSessionData: any = await db.readPersistData();

  try {
    if (!persistedSessionData && !persistedSessionData.accessJwt)
      throw new Error("No persisted session data found. Using login/password.");
    let sessionData: AtpSessionData = persistedSessionData;
    let session = await bskyAgent.resumeSession(sessionData);
    if (session.success) {
      console.log(
        `[${new Date().toUTCString()}] - [bsky.rss LOGIN] Resumed session for ${
          session.data.handle
        }`
      );
      return session;
    } else {
      throw new Error("Login failed (auth via persisted session)");
    }
  } catch (e: any) {
    let loginData = await bskyAgent.login({ identifier, password });
    if (!loginData.success)
      throw new Error("Login failed (auth via login/password)");
    return loginData;
  }
}

async function post({
  content,
  embed,
  languages,
  date,
}: {
  content: string;
  embed?: any;
  languages?: string[];
  date?: Date;
}) {
  if (!bskyAgent) throw new Error("Bluesky agent not initialized.");

  const bskyText = new RichText({ text: content });
  await bskyText.detectFacets(bskyAgent);

  let embedImage: any = null;
  if (embed && embed.image) {
    try {
      embedImage = await bskyAgent.uploadBlob(embed.image, {
        encoding: "image/jpeg",
      });
    } catch (e: any) {
      embedImage = { ratelimit: true };
    }
  }
  if (embedImage && embedImage.ratelimit) return { ratelimit: true };

  let embed_data = undefined;

  if (embed) {
    if (embed.type == "image") {
      if (embed.image) {
        embed_data = {
          $type: "app.bsky.embed.images",
          images: [
            {
              image: embed.image ? embedImage.data.blob : undefined,
              alt: embed.imageAlt ? embed.imageAlt : "",
            },
          ],
        };
      }
    } else {
      embed_data = {
        $type: "app.bsky.embed.external",
        external: {
          uri: embed.uri,
          title: embed.title,
          description: embed.description ? embed.description : "",
          thumb: embed.image ? embedImage.data.blob : undefined,
        },
      };
    }
  }

  if (!date) {
    date = new Date();
  }

  const record = {
    $type: "app.bsky.feed.post",
    text: bskyText.text,
    facets: bskyText.facets,
    embed: embed_data,
    langs: languages,
    createdAt: date.toISOString(),
  };

  let post: any;
  try {
    post = await bskyAgent.post(record);
  } catch (error: any) {
    // if (error instanceof XRPCError) {
    if (error.constructor.name == XRPCError.name) {
      let xrpc_error: XRPCError = error;

      if (xrpc_error.status == ResponseType.UpstreamTimeout) {
        // @ts-ignore
        let headers = xrpc_error.headers;

        if (
          headers &&
          headers.hasOwnProperty("Retry-After") &&
          headers["Retry-After"]
        ) {
          let retryAfter: number = +headers["Retry-After"];
          post = { ratelimit: true, retryAfter: retryAfter };
        }
      }
    }

    if (!post) post = { ratelimit: true, retryAfter: 30 };
  } finally {
    return post;
  }
}

export default {
  init,
  login,
  post,
};
