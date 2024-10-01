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
var helper_time_exports = {};
__export(helper_time_exports, {
  buildDate: () => buildDate,
  convertStringToDate: () => convertStringToDate,
  correctHour: () => correctHour,
  correctHours: () => correctHours,
  extraktHour: () => extraktHour,
  formatDate: () => formatDate,
  formatHour: () => formatHour,
  getDateUTC: () => getDateUTC,
  logDate: () => logDate,
  logDate4File: () => logDate4File,
  subtractTwoHours: () => subtractTwoHours,
  toHoursAndMinutes: () => toHoursAndMinutes
});
module.exports = __toCommonJS(helper_time_exports);
function getDateUTC() {
  const d = /* @__PURE__ */ new Date();
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds()
  );
}
function buildDate(h) {
  const d = /* @__PURE__ */ new Date();
  console.log(d);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, d.getMinutes(), d.getSeconds());
}
const toHoursAndMinutes = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${("00" + minutes).slice(-2)}m`;
};
function formatDate(d) {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function logDate4File() {
  const d = /* @__PURE__ */ new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}
function logDate() {
  const now = /* @__PURE__ */ new Date();
  return now.toLocaleString("fr-CH");
}
function formatHour(d) {
  const hour = d.getHours().toString().padStart(2, "0");
  console.log(`(f) formatHour ${hour}`);
  return hour;
}
function convertStringToDate(stringFromApi) {
  const newDate = new Date(stringFromApi);
  return newDate;
}
function correctHours(d, offset) {
  d.setHours(d.getHours() - offset);
  return d;
}
function subtractTwoHours() {
  const currentDate = /* @__PURE__ */ new Date();
  currentDate.setHours(currentDate.getHours() - 2);
  return currentDate;
}
function extraktHour(s) {
  const timeString = s.split(" ")[1];
  const hour = timeString.split(":")[0];
  return hour;
}
function correctHour(s, offset) {
  const dateString = s.split(" ")[0].split("-");
  const sDate = dateString[2] + "." + dateString[1] + "." + dateString[0];
  const timeString = s.split(" ")[1].split(":");
  const hour = parseInt(timeString[0]) + offset;
  const sHour = hour.toString().padStart(2, "0");
  const sTime = sHour + ":" + timeString[1] + " Uhr";
  return `${sDate} ${sTime}`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildDate,
  convertStringToDate,
  correctHour,
  correctHours,
  extraktHour,
  formatDate,
  formatHour,
  getDateUTC,
  logDate,
  logDate4File,
  subtractTwoHours,
  toHoursAndMinutes
});
//# sourceMappingURL=helper_time.js.map
