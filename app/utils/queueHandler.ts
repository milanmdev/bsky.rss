import bsky from "./bskyHandler";
import db from "./dbHandler";

let queue: QueueItems[] = [];
let rateLimited: boolean = false;
let queueRunning: boolean = false;
let queueSnapshot: QueueItems[] = [];

let config: Config = {
  string: "",
  publishEmbed: false,
  embedType: "card",
  languages: ["en"],
  truncate: true,
  runInterval: 60,
  dateField: "",
  imageField: "",
  ogUserAgent: "bsky.rss/1.0 (Open Graph Scraper)",
  descriptionClearHTML: true,
  forceDescriptionEmbed: false,
  imageAlt: "",
};

async function start() {
  config = await db.initConfig();
  console.log(
    `[${new Date().toUTCString()}] - [bsky.rss QUEUE] Starting queue handler. Running every ${
      config.runInterval
    } seconds`
  );
  setInterval(function () {
    runQueue();
  }, config.runInterval * 1000);
}

async function createLimitTimer(timeoutSeconds: number = 30) {
  if (!rateLimited) return;
  rateLimited = true;
  setTimeout(() => {
    rateLimited = false;
    runQueue();
    console.log(
      `[${new Date().toUTCString()}] - [bsky.rss QUEUE] Post rate limit expired - resuming queue`
    );
  }, timeoutSeconds * 1000);
  return "";
}

async function runQueue() {
  if (queueRunning) return;
  queueSnapshot = [...queue];
  console.log(
    `[${new Date().toUTCString()}] - [bsky.rss QUEUE] Running queue with ${
      queueSnapshot.length
    } items`
  );
  if (rateLimited) return { ratelimit: true };
  if (queueSnapshot.length > 0) {
    queueRunning = true;
    for (let i = 0; i < queueSnapshot.length; i++) {
      let item = queueSnapshot[i] as QueueItems;
      queue.splice(i, 1);
      queueSnapshot.splice(i, 1);
      i--;
      let post = await bsky.post({
        content: item.content,
        embed: item.embed,
        languages: item.languages,
      });
      // @ts-ignore
      if (post.ratelimit) {
        queue.unshift(item);
        let timeoutSeconds: number = post.retryAfter ? post.retryAfter : 30;
        await createLimitTimer(timeoutSeconds);
        queueRunning = false;
        console.log(
          `[${new Date().toUTCString()}] - [bsky.rss POST] Post rate limit exceeded - process will resume after ${timeoutSeconds} seconds`
        );
        break;
      } else {
        console.log(
          `[${new Date().toUTCString()}] - [bsky.rss POST] Posting new item (${
            item.title
          })`
        );
        db.writeDate(new Date(item.date));
        if (i === queueSnapshot.length - 1) {
          queueRunning = false;
          queueSnapshot = [];
          console.log(
            `[${new Date().toUTCString()}] - [bsky.rss QUEUE] Finished running queue. Next run in ${
              config.runInterval
            } seconds`
          );
        }
      }
    }
    return queue;
  } else {
    return queue;
  }
}

async function writeQueue({
  content,
  embed,
  languages,
  title,
  date,
}: QueueItems) {
  console.log(
    `[${new Date().toUTCString()}] - [bsky.rss QUEUE] Queuing item (${title})`
  );
  queue.push({ content, embed, languages, title, date });
  return queue;
}

export default { writeQueue, start };
