import bsky from "./bskyHandler";

let queue: QueueItems[] = [];
let rateLimited: boolean = false;
let queueRunning: boolean = false;

interface QueueItems {
  content: string;
  embed: Embed | undefined;
  languages: string[] | undefined;
  title: string;
}

interface Embed {
  uri: string;
  title: string;
  description?: string;
  image?: Buffer;
}

async function start() {
  setInterval(function () {
    runQueue();
  }, 60000);
}

async function createLimitTimer() {
  if (!rateLimited) return;
  rateLimited = true;
  setTimeout(() => {
    rateLimited = false;
    runQueue();
    console.log(
      `[${new Date().toUTCString()}] - [bsky.rss] Post rate limit expired - resuming queue`
    );
  }, 30000);
  return "";
}

async function runQueue() {
  if (rateLimited) return { ratelimit: true };
  if (queue.length > 0) {
    queueRunning = true;
    for (let i = 0; i < queue.length; i++) {
      let item = queue[i] as QueueItems;
      queue.splice(i, 1);
      i--;
      let post = await bsky.post({
        content: item.content,
        embed: item.embed,
        languages: item.languages,
      });
      console.log(post.ratelimit);
      // @ts-ignore
      if (post.ratelimit) {
        await createLimitTimer();
        queueRunning = false;
        console.log(
          `[${new Date().toUTCString()}] - [bsky.rss] Post rate limit exceeded - process will resume after 30 seconds`
        );
        break;
      } else {
        if (i === queue.length - 1) queueRunning = false;
        console.log(
          `[${new Date().toUTCString()}] - [bsky.rss] Posting new item (${
            item.title
          })`
        );
      }
    }
    return queue;
  } else {
    return queue;
  }
}

async function writeQueue({ content, embed, languages, title }: QueueItems) {
  queue.push({ content, embed, languages, title });
  return queue;
}

export default { writeQueue, start };
