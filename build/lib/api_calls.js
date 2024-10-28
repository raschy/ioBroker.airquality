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
var api_calls_exports = {};
__export(api_calls_exports, {
  getComponents: () => getComponents,
  getMeasurements: () => getMeasurements,
  getStations: () => getStations
});
module.exports = __toCommonJS(api_calls_exports);
const baseUrl = "https://umweltbundesamt.api.proxy.bund.dev/api/air_data/v3/";
async function getStations() {
  const url = baseUrl + "stations/json?lang=de";
  const _stations = {};
  return fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    }
  }).then(async (response) => {
    if (!response.ok)
      throw new Error("[getStations] failed to retrieve data");
    const data = await response.json();
    for (const key in data.data) {
      const stationId = data.data[key][0];
      _stations[stationId] = {
        id: data.data[key][0],
        code: data.data[key][1],
        city: data.data[key][3],
        street: data.data[key][17],
        number: data.data[key][18],
        zipcode: data.data[key][19],
        lon: data.data[key][7],
        lat: data.data[key][8]
      };
    }
    return _stations;
  });
}
async function getComponents() {
  const url = baseUrl + "components/json?lang=de&index=id";
  const _components = {};
  return fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    }
  }).then(async (response) => {
    if (!response.ok)
      throw new Error("[getComponents] failed to retrieve data");
    const data = await response.json();
    for (const key in data) {
      if (!isNaN(parseInt(key))) {
        _components[key] = { name: data[key][1], unit: data[key][3], desc: data[key][4] };
      }
    }
    return _components;
  });
}
async function getMeasurements(stationCode) {
  const urlSpec = "airquality/json?";
  const urlStation = await prepareQueryParameters(stationCode);
  const url = [baseUrl, urlSpec, urlStation].join("");
  let _measurements = {};
  return fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    }
  }).then(async (response) => {
    if (!response.ok)
      throw new Error("[getMeasurements] failed to retrieve data");
    const data = await response.json();
    _measurements = data.data;
    return _measurements;
  });
}
async function prepareQueryParameters(stationCode) {
  const parameters = [];
  const workDate = getDateUTC();
  const _hour = workDate.getHours();
  const _hourFrom = _hour < 1 ? 24 : _hour;
  const dateFrom = "date_from=" + formatDate(workDate);
  parameters.push(dateFrom);
  const timeFrom = "time_from=" + String(_hourFrom);
  parameters.push(timeFrom);
  const dateTo = "date_to=" + formatDate(workDate);
  parameters.push(dateTo);
  const timeTo = "time_to=" + String(_hourFrom);
  parameters.push(timeTo);
  parameters.push("station=" + stationCode);
  parameters.push("lang=de");
  const preparedQueryParameter = parameters.join("&");
  console.log(`Parameter: ${preparedQueryParameter}`);
  return preparedQueryParameter;
}
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
function formatDate(d) {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getComponents,
  getMeasurements,
  getStations
});
//# sourceMappingURL=api_calls.js.map
