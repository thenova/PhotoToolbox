"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const fs = require("fs");
electron.protocol.registerSchemesAsPrivileged([
  { scheme: "localfile", privileges: { secure: true, bypassCSP: true, stream: true, corsEnabled: true, supportFetchAPI: true } }
]);
const PHOTO_EXTENSIONS = /* @__PURE__ */ new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".tiff",
  ".tif",
  ".heic",
  ".heif",
  ".raw",
  ".cr2",
  ".cr3",
  ".nef",
  ".nrw",
  ".arw",
  ".srf",
  ".sr2",
  ".dng",
  ".raf",
  ".orf",
  ".rw2",
  ".pef",
  ".srw",
  ".3fr",
  ".fff",
  ".iiq",
  ".rwl",
  ".x3f",
  ".erf",
  ".mef",
  ".mos"
]);
function isPhoto(filename) {
  return PHOTO_EXTENSIONS.has(path.extname(filename).toLowerCase());
}
function getDateFromFile(filePath, exifData) {
  if (exifData) {
    const raw = exifData["DateTimeOriginal"] || exifData["CreateDate"] || exifData["ModifyDate"];
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return new Date(fs.statSync(filePath).mtime);
}
function buildDestPath(destDir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = path.join(destDir, filename);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(destDir, `${base}_${counter}${ext}`);
    counter++;
  }
  return candidate;
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.photo-toolbox");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  electron.protocol.handle("localfile", (request) => {
    return electron.net.fetch("file" + request.url.slice("localfile".length));
  });
  electron.ipcMain.handle("dialog:openFolder", async () => {
    const result = await electron.dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  electron.ipcMain.handle("photos:verify", async (_event, folderPath) => {
    try {
      const entries = fs.readdirSync(folderPath);
      const photos = entries.filter(isPhoto);
      return { success: true, count: photos.length, files: photos };
    } catch (err) {
      return { success: false, count: 0, files: [], error: String(err) };
    }
  });
  electron.ipcMain.handle("photos:preview", async (_event, folderPath) => {
    try {
      const files = fs.readdirSync(folderPath).filter(isPhoto);
      let exifr = null;
      try {
        const mod = await import("exifr");
        exifr = mod.default ?? mod;
      } catch {
      }
      const tree = {};
      for (const file of files) {
        const filePath = path.join(folderPath, file);
        let exifData = null;
        try {
          if (exifr) exifData = await exifr.parse(filePath, ["DateTimeOriginal", "CreateDate", "ModifyDate"]);
        } catch {
        }
        const date = getDateFromFile(filePath, exifData);
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        if (!tree[year]) tree[year] = {};
        if (!tree[year][month]) tree[year][month] = {};
        if (!tree[year][month][day]) tree[year][month][day] = [];
        tree[year][month][day].push(file);
      }
      return { success: true, tree, totalFiles: files.length };
    } catch (err) {
      return { success: false, tree: {}, totalFiles: 0, error: String(err) };
    }
  });
  electron.ipcMain.handle(
    "photos:copy",
    async (event, { source, destinations }) => {
      let successCount = 0;
      let failedCount = 0;
      const errors = [];
      let exifr = null;
      try {
        const mod = await import("exifr");
        exifr = mod.default ?? mod;
      } catch {
      }
      const files = fs.readdirSync(source).filter(isPhoto);
      const total = files.length * destinations.length;
      let processed = 0;
      for (const file of files) {
        const sourcePath = path.join(source, file);
        let exifData = null;
        try {
          if (exifr) {
            exifData = await exifr.parse(sourcePath, [
              "DateTimeOriginal",
              "CreateDate",
              "ModifyDate"
            ]);
          }
        } catch {
        }
        const date = getDateFromFile(sourcePath, exifData);
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        for (const dest of destinations) {
          processed++;
          const destDir = path.join(dest, year, month, day);
          try {
            fs.mkdirSync(destDir, { recursive: true });
            const destPath = buildDestPath(destDir, file);
            fs.copyFileSync(sourcePath, destPath);
            successCount++;
          } catch (err) {
            failedCount++;
            errors.push(`${file} → ${dest}: ${String(err)}`);
          }
          event.sender.send("photos:progress", {
            current: processed,
            total,
            file,
            successCount,
            failedCount
          });
        }
      }
      return { success: successCount, failed: failedCount, errors };
    }
  );
  electron.ipcMain.handle("exif:loadFolder", (_event, folderPath) => {
    try {
      const files = fs.readdirSync(folderPath).filter(isPhoto).map((name) => ({ name, path: path.join(folderPath, name) }));
      return { success: true, files };
    } catch (err) {
      return { success: false, files: [], error: String(err) };
    }
  });
  electron.ipcMain.handle("exif:readTags", async (_event, filePath) => {
    try {
      let exifr = null;
      try {
        const mod = await import("exifr");
        exifr = mod.default ?? mod;
      } catch {
      }
      if (!exifr) return { success: false, tags: {}, error: "exifr unavailable" };
      const raw = await exifr.parse(filePath, {
        all: true,
        translateKeys: true,
        translateValues: true,
        reviveValues: true
      });
      const tags = {};
      for (const [k, v] of Object.entries(raw ?? {})) {
        if (v === void 0 || v === null) continue;
        if (v instanceof Date) {
          tags[k] = v.toISOString();
          continue;
        }
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          tags[k] = v;
          continue;
        }
        if (Array.isArray(v)) {
          tags[k] = v.map((x) => x instanceof Date ? x.toISOString() : typeof x === "object" ? String(x) : x);
          continue;
        }
        try {
          JSON.stringify(v);
          tags[k] = v;
        } catch {
          tags[k] = String(v);
        }
      }
      return { success: true, tags };
    } catch (err) {
      return { success: false, tags: {}, error: String(err) };
    }
  });
  electron.ipcMain.handle("exif:saveTags", (_event, filePath, changes) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".jpg" && ext !== ".jpeg") {
      return { success: false, error: "EXIF editing is only supported for JPEG files." };
    }
    try {
      const WRITABLE = {
        ImageDescription: { ifd: "0th", num: 270, isDate: false },
        Software: { ifd: "0th", num: 305, isDate: false },
        ModifyDate: { ifd: "0th", num: 306, isDate: true },
        Artist: { ifd: "0th", num: 315, isDate: false },
        Copyright: { ifd: "0th", num: 33432, isDate: false },
        DateTimeOriginal: { ifd: "Exif", num: 36867, isDate: true },
        CreateDate: { ifd: "Exif", num: 36868, isDate: true }
      };
      const piexif = require("piexifjs");
      const data = fs.readFileSync(filePath, "binary");
      const exifObj = piexif.load(data);
      for (const [key, value] of Object.entries(changes)) {
        const info = WRITABLE[key];
        if (!info) continue;
        const exifAny = exifObj;
        if (!exifAny[info.ifd]) exifAny[info.ifd] = {};
        const ifd = exifAny[info.ifd];
        if (info.isDate) {
          const [datePart = "", timePart = "00:00"] = value.split("T");
          const time = timePart.length >= 5 ? `${timePart.slice(0, 5)}:00` : "00:00:00";
          ifd[info.num] = `${datePart.replace(/-/g, ":")} ${time}`;
        } else {
          ifd[info.num] = value;
        }
      }
      const exifBytes = piexif.dump(exifObj);
      const newData = piexif.insert(exifBytes, data);
      fs.writeFileSync(filePath, Buffer.from(newData, "binary"));
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
