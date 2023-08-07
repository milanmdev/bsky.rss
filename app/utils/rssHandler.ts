import FeedSub from "feedsub";
import sharp from "sharp";
import axios from "axios";
import queue from "./queueHandler";
import db from "./dbHandler";
import og from "open-graph-scraper";
let reader: any = null;
let lastDate: string = "";

let config: Config = {
  string: "",
  publishEmbed: false,
  languages: ["en"],
  truncate: true,
  runInterval: 60,
  dateField: "",
};

async function start() {
  reader.read();

  reader.on("item", async (item: Item) => {
    let useDate = config.dateField
      ? // @ts-ignore
        item[config.dateField]
      : item.pubdate
      ? item.pubdate
      : item.published;
    if (!useDate)
      return console.log("No date provided by RSS reader for post.");

    if (new Date(useDate) <= new Date(lastDate)) return;

    // @ts-ignore
    let parsed = parseString(config.string, item);
    let embed: Embed | undefined = undefined;
    if (config.publishEmbed) {
      if (!item.link)
        throw new Error(
          "No link provided from RSS reader to fetch Open Graph data."
        );
      let url = "";
      if (typeof item.link === "object") url = item.link.href;
      else url = item.link;

      let openGraphData: any = await og({
        url,
        fetchOptions: {
          headers: {
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
          },
        },
      })
        .then((res) => (res.error ? { error: true } : res.result))
        .catch(() => ({
          error: true,
        }));
      if (!openGraphData.error) {
        let image: Buffer | undefined = undefined;
        if (openGraphData.ogImage && openGraphData.ogImage[0]) {
          let fetchBuffer = await axios.get(openGraphData.ogImage[0].url, {
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

        if (
          (!openGraphData.ogUrl && !url) ||
          (!openGraphData.ogTitle && !item.title) ||
          (!openGraphData.ogDescription && !item.description)
        ) {
          embed = undefined;
        } else {
          embed = {
            uri: openGraphData.ogUrl ? openGraphData.ogUrl : url,
            title: openGraphData.ogTitle ? openGraphData.ogTitle : item.title,
            description: openGraphData.ogDescription
              ? openGraphData.ogDescription
              : item.description,
            image,
          };
        }
      } else {
        embed = {
          uri: url,
          title: item.title,
          description: item.description,
        };
      }
    }

    await queue.writeQueue({
      content: parsed.text,
      title: item.title,
      embed: config.publishEmbed ? embed : undefined,
      languages: config.languages ? config.languages : undefined,
      date: useDate,
    });
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
