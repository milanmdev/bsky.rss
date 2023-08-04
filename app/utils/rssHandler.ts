import FeedSub from "feedsub";
import sharp from "sharp";
import axios from "axios";
import bsky from "./bskyHandler";
import db from "./dbHandler";
import queue from "./queueHandler";
let reader: any = null;
let lastDate: string = "";

interface Config {
  string: string;
  publishEmbed?: boolean;
  languages?: string[];
  truncate?: boolean;
  useQueue?: boolean;
}

let config: Config = {
  string: "",
  publishEmbed: false,
  languages: ["en"],
  truncate: true,
};

interface Item {
  title: string;
  link: {
    href: string;
  };
  published?: string;
  pubdate?: string;
  description: string;
}

interface ParseResult {
  text: string;
}

interface Embed {
  uri: string;
  title: string;
  description?: string;
  image?: Buffer;
}

async function start() {
  reader.read();

  reader.on("item", async (item: Item) => {
    let useDate = item.pubdate ? item.pubdate : item.published;
    if (!useDate)
      return console.log("No date provided by RSS reader for post.");

    if (new Date(useDate) <= new Date(lastDate)) return;

    console.log(
      `[${new Date().toUTCString()}] - [bsky.rss] Queuing item (${item.title})`
    );

    // @ts-ignore
    db.writeDate(new Date(useDate));
    let parsed = parseString(config.string, item);
    let embed: Embed = {
      uri: "",
      title: "",
    };
    if (config.publishEmbed) {
      if (!item.link)
        throw new Error(
          "No link provided from RSS reader to fetch Open Graph data."
        );
      let url = "";
      if (typeof item.link === "object") url = item.link.href;
      else url = item.link;

      let openGraphData: any = await axios.get(
        `https://cardyb.bsky.app/v1/extract?url=${encodeURIComponent(url)}`
      );
      if (!openGraphData.data.error) {
        let image: Buffer | undefined = undefined;
        if (openGraphData.data.image) {
          let fetchBuffer = await axios.get(openGraphData.data.image, {
            responseType: "arraybuffer",
          });
          image = await sharp(fetchBuffer.data)
            .resize(800, null, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({
              quality: 80,
              progressive: true,
            })
            .toBuffer();
        }

        embed = {
          uri: openGraphData.data.url,
          title: openGraphData.data.title,
          description: openGraphData.data.description,
          image,
        };
      }
    }

    if (config.useQueue) {
      await queue.writeQueue({
        content: parsed.text,
        title: item.title,
        embed: config.publishEmbed ? embed : undefined,
        languages: config.languages ? config.languages : undefined,
      });
    } else {
      await bsky.post({
        content: parsed.text,
        embed: config.publishEmbed ? embed : undefined,
        languages: config.languages ? config.languages : undefined,
      });
    }
  });
}

async function init({
  fetch_interval,
  fetch_url,
}: {
  fetch_interval: number;
  fetch_url: URL;
}) {
  config = await db.initConfig();
  if (!config.string) throw new Error("No string provided.");

  reader = new FeedSub(String(fetch_url), {
    interval: fetch_interval,
    emitOnStart: true,
    lastDate: (await db.readLast()) ? await db.readLast() : null,
  });

  lastDate = await db.readLast();
  return reader;
}

async function launch() {
  reader.start();
  return reader;
}

export default {
  start,
  init,
  launch,
};

function parseString(string: string, item: Item) {
  let result: ParseResult = {
    text: "",
  };

  let parsedString = string;
  if (string.includes("$title")) {
    if (!item.title) throw new Error("No title provided from RSS reader.");
    parsedString = parsedString.replace("$title", item.title);
  }

  if (string.includes("$link")) {
    if (!item.link) throw new Error("No link provided from RSS reader.");
    if (typeof item.link === "object") {
      parsedString = parsedString.replace("$link", item.link.href);
    } else {
      parsedString = parsedString.replace("$link", item.link);
    }
  }

  if (string.includes("$description") || item.description) {
    if (string.includes("$description")) {
      parsedString = parsedString.replace("$description", item.description);
    }
  }

  if (parsedString.length > 300 && config.truncate === true) {
    parsedString = parsedString.slice(0, 277) + "...";
  }
  result.text = parsedString;
  return result;
}
