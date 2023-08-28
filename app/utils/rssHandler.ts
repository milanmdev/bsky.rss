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
  imageField: "",
  ogUserAgent: "bsky.rss/1.0 (Open Graph Scraper)",
  descriptionClearHTML: true,
  forceDescriptionEmbed: false,
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

    let parsed = parseString(
      config.string,
      item,
      item.description ? item.description : item.content
    );
    let embed: Embed | undefined = undefined;

    if (config.publishEmbed) {
      if (!item.link)
        throw new Error(
          "No link provided from RSS reader to fetch Open Graph data."
        );
      let url = "";
      if (typeof item.link === "object") url = item.link.href;
      else url = item.link;

      let image: Buffer | undefined = undefined;
      let description: string | undefined = undefined;

      if (config.imageField != "" && config.imageField != undefined) {
        let imageUrl: string = "";
        let imageKey: string | undefined = config.imageField;
        if (imageKey != "" && imageKey != undefined) {
          if (Object.keys(item).includes(imageKey)) {
            if (
              Object.keys(item[imageKey]).includes("url") &&
              !(Object.keys(item[imageKey]).includes("type") &&
              !item[imageKey]["type"].startsWith("image"))
            ) {
              imageUrl = item[imageKey]["url"];
            }
          }
        }

        if (imageUrl != "") {
          image = await fetchImage(imageUrl);

          if (image == undefined) {
            console.log(
              `[${new Date().toUTCString()}] - [bsky.rss FETCH] Error fetching image for ${
                item.title
              } (${imageUrl})`
            );
          }
        }
      }

      if (config.forceDescriptionEmbed) {
        description = item.description
          ? item.description
          : item.content
          ? item.content
          : undefined;

        if (description && config.descriptionClearHTML) {
          description = removeHTMLTags(description);
        }
      }

      let openGraphData: any = await og({
        url,
        fetchOptions: {
          headers: {
            "user-agent": config.ogUserAgent,
          },
        },
      })
        .then((res) => (res.error ? { error: true } : res.result))
        .catch(() => ({
          error: true,
        }));

      if (!openGraphData.error) {
        if (image == undefined && openGraphData.ogImage) {
          let imageUrl: string = openGraphData.ogImage[0].url;

          if (imageUrl != "" && imageUrl != undefined) {
            image = await fetchImage(imageUrl);

            if (image == undefined) {
              console.log(
                `[${new Date().toUTCString()}] - [bsky.rss FETCH] Error fetching image for ${
                  item.title
                } (${imageUrl})`
              );
            }
          }

          if (description == undefined) {
            description = openGraphData.ogDescription
              ? openGraphData.ogDescription
              : config.forceDescriptionEmbed == true && undefined;
          }
        }

        if (description !== undefined && config.descriptionClearHTML) {
          description = removeHTMLTags(description);
        }

        if (
          (!openGraphData.ogUrl && !url) ||
          (!openGraphData.ogTitle && !item.title) ||
          !description
        ) {
          embed = undefined;
        } else {
          embed = {
            uri: openGraphData.ogUrl ? openGraphData.ogUrl : url,
            title: openGraphData.ogTitle ? openGraphData.ogTitle : item.title,
            description: description,
            image: image,
          };
        }
      } else {
        console.log(
          `[${new Date().toUTCString()}] - [bsky.rss FETCH] Error fetching Open Graph data for ${
            item.title
          } (${url})]: ${openGraphData.error}`
        );

        embed = {
          uri: url,
          title: item.title,
          description: item.description || item.content,
          image: image,
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

function parseString(string: string, item: Item, description: string) {
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

  if (string.includes("$description") && description) {
    if (config.descriptionClearHTML) description = removeHTMLTags(description);
    parsedString = parsedString.replace("$description", description);
  }

  if (parsedString.length > 300 && config.truncate === true) {
    parsedString = parsedString.slice(0, 277) + "...";
  }
  result.text = parsedString;
  return result;
}

async function fetchImage(imageUrl: string) {
  let image: Buffer | undefined = undefined;

  try {
    let fetchBuffer = await axios.get(imageUrl, {
      headers: {
        "User-Agent": config.ogUserAgent,
      },
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
  } catch (e) {}

  return image;
}

function removeHTMLTags(htmlString: string) {
  return htmlString
    ?.replace(/<\/?[^>]+(>|$)/g, " ")
    .replaceAll("&nbsp;", " ")
    .trim()
    .replace(/  +/g, " ");
}
