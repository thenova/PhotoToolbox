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
  electron.ipcMain.handle("map:scan", async (event, folderPath) => {
    function collectPhotos(dir, depth) {
      if (depth > 10) return [];
      const results = [];
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) results.push(...collectPhotos(full, depth + 1));
          else if (isPhoto(entry.name)) results.push(full);
        }
      } catch {
      }
      return results;
    }
    const allFiles = collectPhotos(folderPath, 0);
    const total = allFiles.length;
    const geoPhotos = [];
    let exifr = null;
    try {
      const m = await import("exifr");
      exifr = m.default ?? m;
    } catch {
    }
    for (let i = 0; i < total; i++) {
      const filePath = allFiles[i];
      let photo = null;
      try {
        if (exifr) {
          const data = await exifr.parse(filePath, {
            gps: true,
            reviveValues: true,
            translateValues: true,
            mergeOutput: true
          });
          if (data?.latitude != null && data?.longitude != null) {
            photo = {
              path: filePath,
              name: path.basename(filePath),
              lat: data.latitude,
              lng: data.longitude,
              date: data.DateTimeOriginal instanceof Date ? data.DateTimeOriginal.toISOString() : null
            };
            geoPhotos.push(photo);
          }
        }
      } catch {
      }
      event.sender.send("map:progress", { current: i + 1, total, photo });
    }
    return geoPhotos;
  });
  electron.ipcMain.handle("rename:loadMeta", async (event, folderPath) => {
    try {
      const files = fs.readdirSync(folderPath).filter(isPhoto);
      const total = files.length;
      let exifr = null;
      try {
        const m = await import("exifr");
        exifr = m.default ?? m;
      } catch {
      }
      const metas = [];
      for (let i = 0; i < files.length; i++) {
        const name = files[i];
        const filePath = path.join(folderPath, name);
        const ext = path.extname(name).toLowerCase();
        const baseName = path.basename(name, path.extname(name));
        const stat = fs.statSync(filePath);
        let date = null;
        let cameraMake = "";
        let cameraModel = "";
        try {
          if (exifr) {
            const data = await exifr.parse(filePath, {
              reviveValues: true,
              pick: ["DateTimeOriginal", "Make", "Model"]
            });
            if (data) {
              if (data.DateTimeOriginal instanceof Date) date = data.DateTimeOriginal.toISOString();
              cameraMake = String(data.Make || "").trim();
              cameraModel = String(data.Model || "").trim();
            }
          }
        } catch {
        }
        metas.push({ name, path: filePath, ext, baseName, date, fileDate: stat.mtime.toISOString(), cameraMake, cameraModel });
        event.sender.send("rename:progress", { current: i + 1, total });
      }
      return { success: true, metas };
    } catch (err) {
      return { success: false, metas: [], error: String(err) };
    }
  });
  electron.ipcMain.handle("rename:apply", (_event, renames) => {
    let success = 0, failed = 0;
    const errors = [];
    for (const { from, to } of renames) {
      try {
        if (from === to) continue;
        if (fs.existsSync(to)) {
          failed++;
          errors.push(`${path.basename(from)}: target already exists`);
          continue;
        }
        fs.renameSync(from, to);
        success++;
      } catch (err) {
        failed++;
        errors.push(`${path.basename(from)}: ${String(err)}`);
      }
    }
    return { success, failed, errors };
  });
  electron.ipcMain.handle("meta:scan", async (event, folderPath) => {
    function collectPhotos(dir, depth) {
      if (depth > 10) return [];
      const results = [];
      try {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) results.push(...collectPhotos(full, depth + 1));
          else if (isPhoto(e.name)) results.push(full);
        }
      } catch {
      }
      return results;
    }
    const allFiles = collectPhotos(folderPath, 0);
    const total = allFiles.length;
    let exifr = null;
    try {
      const m = await import("exifr");
      exifr = m.default ?? m;
    } catch {
    }
    const cams = /* @__PURE__ */ new Map();
    const lenses = /* @__PURE__ */ new Map();
    const apertures = /* @__PURE__ */ new Map();
    const shutters = /* @__PURE__ */ new Map();
    const isos = /* @__PURE__ */ new Map();
    const focals = /* @__PURE__ */ new Map();
    const yrs = /* @__PURE__ */ new Map();
    let flashUsed = 0, flashNotUsed = 0, flashUnknown = 0, withExif = 0;
    const inc = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
    for (let i = 0; i < total; i++) {
      try {
        if (exifr) {
          const d = await exifr.parse(allFiles[i], {
            reviveValues: true,
            mergeOutput: true,
            pick: [
              "Make",
              "Model",
              "LensModel",
              "LensMake",
              "FNumber",
              "ExposureTime",
              "ISO",
              "FocalLength",
              "DateTimeOriginal",
              "Flash"
            ]
          });
          if (d) {
            withExif++;
            inc(cams, [d.Make, d.Model].filter(Boolean).map(String).join(" ").trim() || "Unknown Camera");
            const lens = String(d.LensModel || d.LensMake || "").trim();
            inc(lenses, lens || "Unknown Lens");
            if (d.FNumber != null) {
              const f = Number(d.FNumber);
              inc(apertures, `f/${Number.isInteger(f) ? f : f.toFixed(1)}`);
            }
            if (d.ExposureTime != null) {
              const et = Number(d.ExposureTime);
              inc(shutters, et >= 1 ? `${et} s` : `1/${Math.round(1 / et)} s`);
            }
            if (d.ISO != null) inc(isos, String(d.ISO));
            if (d.FocalLength != null) inc(focals, `${Math.round(Number(d.FocalLength))} mm`);
            if (d.DateTimeOriginal instanceof Date) inc(yrs, String(d.DateTimeOriginal.getFullYear()));
            if (d.Flash != null) {
              if ((Number(d.Flash) & 1) === 1) flashUsed++;
              else flashNotUsed++;
            } else flashUnknown++;
          }
        }
      } catch {
      }
      event.sender.send("meta:progress", { current: i + 1, total });
    }
    const byCount = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    const byKey = (m, parse) => [...m.entries()].sort((a, b) => parse(a[0]) - parse(b[0]));
    return {
      total: allFiles.length,
      withExif,
      cameras: byCount(cams),
      lenses: byCount(lenses),
      apertures: byKey(apertures, (s) => parseFloat(s.replace("f/", ""))),
      shutterSpeeds: byKey(shutters, (s) => s.startsWith("1/") ? 1 / parseInt(s.slice(2)) : parseFloat(s)),
      isos: byKey(isos, (s) => parseFloat(s)),
      focalLengths: byKey(focals, (s) => parseFloat(s)),
      years: [...yrs.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      flash: { used: flashUsed, notUsed: flashNotUsed, unknown: flashUnknown }
    };
  });
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
