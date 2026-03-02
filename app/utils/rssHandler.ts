import FeedSub from "feedsub";
import jimp from "jimp";
import axios from "axios";
import queue from "./queueHandler";
import db from "./dbHandler";
import og from "open-graph-scraper";
import { decode } from "html-entities";

let reader: any = null;
let lastDate: string = "";

let config: Config = {
  string: "",
  publishEmbed: false,
  languages: ["en"],
  truncate: true,
  runInterval: 60,
  publishDate: false,
  dateField: "",
  imageField: "",
  ogUserAgent: "bsky.rss/1.0 (Open Graph Scraper)",
  descriptionClearHTML: true,
  forceDescriptionEmbed: false,
  removeDuplicate: false,
  titleClearHTML: false,
  adaptiveSpacing: false,
  spacingWindow: 600,
  minSpacing: 1,
  maxSpacing: 60,
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

    let parsed = parseString(config.string, item, config.truncate == true);
    let embed: Embed | undefined = undefined;
    let title: string | undefined = undefined;

    if (config.publishEmbed) {
      if (!item.link)
        throw new Error(
          "No link provided from RSS reader to fetch Open Graph data."
        );
      let url = "";
      if (typeof item.link === "object") url = item.link.href;
      else url = item.link;

      if (config.removeDuplicate) {
        if (await db.valueExists(url)) return;
        else await db.writeValue(url);
      } else {
        if (new Date(useDate) <= new Date(lastDate)) return;
      }

      let image: Buffer | undefined = undefined;
      let description: string | undefined = undefined;
      let imageAlt: string | undefined = undefined;

      if (config.imageField != "" && config.imageField != undefined) {
        let imageUrl: string = "";
        let imageKey: string | undefined = config.imageField;
        if (imageKey != "" && imageKey != undefined) {
          if (Object.keys(item).includes(imageKey)) {
            if (
              Object.keys(item[imageKey]).includes("url") &&
              !(
                Object.keys(item[imageKey]).includes("type") &&
                !item[imageKey]["type"].startsWith("image")
              )
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

      if (config.embedType == "image" && config.imageAlt) {
        imageAlt = parseString(config.imageAlt, item, false).text;
      }

      const defaultUserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      const userAgent = config.ogUserAgent || defaultUserAgent;

      let openGraphData: any = await og({
        url,
        timeout: 10000,
        fetchOptions: {
          headers: {
            "user-agent": userAgent,
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9",
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
              : item.description
                ? item.description
                : item.content
                  ? item.content
                  : undefined;
          }
        }

        if (description != undefined && config.descriptionClearHTML) {
          description = removeHTMLTags(description);
        }

        let uri = openGraphData.ogUrl
          ? fixMalformedUrl(openGraphData.ogUrl)
          : url;

        if (openGraphData.ogUrl) {
          let regexURL = new RegExp(
            `^(h|H)(t|T)(t|T)(p|P)(s|S)?:\\/\\/[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)`
          );

          if (!regexURL.test(uri)) uri = url;
        }

        if (!uri || (!openGraphData.ogTitle && !item.title)) {
          embed = undefined;
        } else {
          embed = {
            uri: uri,
            title: openGraphData.ogTitle ? openGraphData.ogTitle : item.title,
            description: description,
            image: image,
            imageAlt: imageAlt,
            type: config.embedType,
          };
        }
      } else {
        console.log(
          `[${new Date().toUTCString()}] - [bsky.rss FETCH] Error fetching Open Graph data for ${
            item.title
          } (${url})`
        );

        description = item.description || item.content;
        if (description && config.descriptionClearHTML) {
          description = removeHTMLTags(description);
        }

        embed = {
          uri: url,
          title: item.title,
          description: description,
          image: image,
          imageAlt: imageAlt,
          type: config.embedType,
        };
      }
    }

    if (new Date(useDate) <= new Date(lastDate)) return;

    title = item.title;

    if (title && config.titleClearHTML) {
      title = decodeHTML(removeHTMLTags(title));
    }

    await queue.writeQueue({
      content: parsed.text,
      title: title,
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

function parseString(string: string, item: Item, truncate: boolean) {
  let result: ParseResult = {
    text: "",
  };

  let parsedString = string;
  if (string.includes("$title")) {
    if (!item.title) throw new Error("No title provided from RSS reader.");

    if (config.titleClearHTML) {
      parsedString = parsedString.replace(
        "$title",
        decodeHTML(removeHTMLTags(item.title))
      );
    } else {
      parsedString = parsedString.replace("$title", item.title);
    }
  }

  if (string.includes("$link")) {
    if (!item.link) throw new Error("No link provided from RSS reader.");
    if (typeof item.link === "object") {
      parsedString = parsedString.replace("$link", item.link.href);
    } else {
      parsedString = parsedString.replace("$link", item.link);
    }
  }

  let description = item.description ? item.description : item.content;

  if (string.includes("$description")) {
    if (config.descriptionClearHTML && description)
      description = removeHTMLTags(description);
    parsedString = parsedString.replace("$description", description);
  }

  if (parsedString.length > 300 && truncate) {
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
    image = await resizeImageToBuffer(fetchBuffer.data);
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

function decodeHTML(htmlString: string) {
  // From my tests, some HTML strings needs to be double-decoded.
  // Ex.: &amp;#233; -> &#233; -> é
  return decode(decode(htmlString));
}

function fixMalformedUrl(urlString: string): string {
  // Fix malformed protocols like "https//" or "http//" (missing colon)
  // These get treated as relative URLs and cause concatenation bugs
  return urlString
    .replace(/^https\/\//i, "https://")
    .replace(/^http\/\//i, "http://");
}

async function resizeImageToBuffer(bufferData: Buffer) {
  try {
    const image = await jimp.read(bufferData);
    const resizedImage = await image
      .resize(800, jimp.AUTO) // null equivalent to Jimp.AUTO, Jimp.AUTO maintains aspect ratio
      .quality(80) // Setting JPEG quality
      .getBufferAsync(jimp.MIME_JPEG); // Getting the buffer as JPEG

    return resizedImage;
  } catch (error) {
    throw error;
  }
}
