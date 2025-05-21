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
  publishDate: false,
  imageField: "",
  ogUserAgent: "bsky.rss/1.0 (Open Graph Scraper)",
  descriptionClearHTML: true,
  forceDescriptionEmbed: false,
  imageAlt: "",
  removeDuplicate: false,
  titleClearHTML: false,
  adaptiveSpacing: false,
  spacingWindow: 600,
  minSpacing: 1,
  maxSpacing: 60,
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
  if (queueSnapshot.length === 0) return queueSnapshot;
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
        date: config.publishDate ? new Date(item.date) : undefined
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
        if (config.adaptiveSpacing && queueSnapshot.length > 0) {
          const remaining = queueSnapshot.length;
          const delaySec = computeDelay(remaining);
          if (delaySec > 0) {
            console.log(
              `[${new Date().toUTCString()}] - [bsky.rss QUEUE] Waiting ${delaySec} seconds before next post`
            );
            await sleep(delaySec * 1000);
          }
        }
        if (i === queueSnapshot.length - 1) {
          queueRunning = false;
          queueSnapshot = [];
          console.log(
            `[${new Date().toUTCString()}] - [bsky.rss QUEUE] Finished running queue. Next run in ${
              config.runInterval
            } seconds`
          );
          if (config.removeDuplicate) db.cleanupOldValues();
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

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function computeDelay(q: number) {
  if (!config.adaptiveSpacing) return 0;
  if (q <= 1) return 0;
  const window = config.spacingWindow || 600;
  const min = config.minSpacing || 1;
  const max = config.maxSpacing || 60;
  return clamp(window / q, min, max);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default { writeQueue, start };
