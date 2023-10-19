import fs from "fs";
let appConfig: any = null;

async function readLast() {
  if (!fs.existsSync(__dirname + "/../../data/last.txt")) {
    fs.writeFileSync(__dirname + "/../../data/last.txt", "", "utf8");
    return "";
  } else {
    let data = fs.readFileSync(__dirname + "/../../data/last.txt", "utf8");
    return data;
  }
}

async function writeDate(date: Date) {
  fs.writeFileSync(
    __dirname + "/../../data/last.txt",
    date.toISOString(),
    "utf8"
  );
  return date;
}

async function readPersistData() {
  if (!fs.existsSync(__dirname + "/../../data/persist.json")) {
    fs.writeFileSync(
      __dirname + "/../../data/persist.json",
      JSON.stringify({}),
      "utf8"
    );
    return {};
  } else {
    let data = fs.readFileSync(__dirname + "/../../data/persist.json", "utf8");
    return JSON.parse(data);
  }
}

async function writePersistDate(persistData: any) {
  fs.writeFileSync(
    __dirname + "/../../data/persist.json",
    JSON.stringify(persistData),
    "utf8"
  );
  return persistData;
}

async function initConfig() {
  try {
    let data = fs.readFileSync(__dirname + "/../../data/config.json", "utf8");
    appConfig = JSON.parse(data);
    return JSON.parse(data);
  } catch (e: any) {
    if (e.toString().startsWith("Error: ENOENT: no such file or directory")) {
      throw new Error("Config file not found.");
    }
  }

  return "";
}

async function readConfig() {
  if (!appConfig) throw new Error("Config not initialized.");
  return JSON.parse(appConfig);
}

export default {
  readLast,
  writeDate,
  readConfig,
  initConfig,
  writePersistDate,
  readPersistData,
};
