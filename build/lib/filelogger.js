"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var filelogger_exports = {};
__export(filelogger_exports, {
  writeLog: () => writeLog
});
module.exports = __toCommonJS(filelogger_exports);
var import_fs = require("fs");
async function writeLog(fileObj, logEntry) {
  const now = /* @__PURE__ */ new Date();
  const dateTime = now.toLocaleString("fr-CH");
  if (!fileObj.path.endsWith("/")) {
    fileObj.path += "/";
    console.log(`"/" wurde an ${fileObj.path} angef\xFCgt.`);
  }
  const dynFilename = createDynfilename(fileObj);
  console.log(`DynFilename: ${dynFilename}`);
  const newFilePath = [fileObj.path, dynFilename].join("");
  console.log(`newFilePath: ${newFilePath}`);
  const data = `${dateTime}	${logEntry}
`;
  console.log(`Logentry: ${data}`);
}
async function appendDataToFile(fileObj, data) {
  if (!fileObj.path.endsWith("/")) {
    fileObj.path += "/";
  }
  try {
    await import_fs.promises.mkdir(fileObj.path, { recursive: true });
    const filename = fileObj.path;
    await import_fs.promises.appendFile(filename, data);
    console.log(`Daten wurden erfolgreich an die Datei ${filename} angeh\xE4ngt.`);
  } catch (error) {
    if (error.code === "EACCES") {
      console.log("Zugriffsfehler: Sie haben keine Berechtigung zum Anh\xE4ngen von Daten an die Datei.");
    } else if (error.code === "ENOENT") {
      console.log("Datei oder Verzeichnis nicht gefunden: " + error.path);
    } else if (error.code === "ENOTDIR") {
      console.log("Pfad ist kein Verzeichnis: " + error.path);
    } else {
      console.log("Ein unbekannter Fehler ist aufgetreten:");
    }
  }
}
function createDynfilename(fileObj) {
  const f = fileObj.file.split(".");
  const dynFile = [f[0], "_", logDate(), ".", f[1]].join("");
  return dynFile;
}
function logDate() {
  const d = /* @__PURE__ */ new Date();
  const year = d.getFullYear() - 2e3;
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  writeLog
});
//# sourceMappingURL=filelogger.js.map
