import process from "process";
import bsky from "./utils/bskyHandler";
import reader from "./utils/rssHandler";
import queue from "./utils/queueHandler";

require("dotenv").config();

if (!process.env.IDENTIFIER) throw new Error("No identifier provided.");
if (!process.env.APP_PASSWORD) throw new Error("No app password provided.");
if (!process.env.FETCH_URL) throw new Error("No fetch URL provided.");
if (!process.env.INSTANCE_URL) throw new Error("No instance URL provided.");

let fetch_interval: number;
if (!process.env.FETCH_INTERVAL) fetch_interval = 5;
else fetch_interval = parseFloat(process.env.FETCH_INTERVAL);

main();
async function main() {
  try {
    /* Initialize Bluesky/Atproto API */
    await bsky.init(String(process.env.INSTANCE_URL));
    await bsky.login({
      identifier: String(process.env.IDENTIFIER),
      password: String(process.env.APP_PASSWORD),
    });

    /* Initialize RSS reader */
    console.log(
      `[${new Date().toUTCString()}] - [bsky.rss APP] Started RSS reader. Fetching from ${
        process.env.FETCH_URL
      } every ${fetch_interval} minutes.`
    );
    await reader.init({
      fetch_interval,
      fetch_url: new URL(String(process.env.FETCH_URL)),
    });
    await reader.start();
    await reader.launch();
    await queue.start();
  } catch (e) {
    if (e == "Error: Rate Limit Exceeded") {
      console.log(
        `[${new Date().toUTCString()}] - [bsky.rss APP] Authentication rate limit exceeded`
      );
      return;
    }
    console.log(`[${new Date().toUTCString()}] - [bsky.rss APP] ${e}`);
  }
}
