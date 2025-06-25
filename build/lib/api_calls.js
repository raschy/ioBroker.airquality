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
  getMeasurementsComp: () => getMeasurementsComp,
  getStations: () => getStations
});
module.exports = __toCommonJS(api_calls_exports);
const baseUrl = "https://www.umweltbundesamt.de/api/air_data/v3/";
async function getStations() {
  const stations = {};
  try {
    const url = `${baseUrl}stations/json?use=measure&lang=de`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      throw new Error(`[getStations] HTTP-Fehler: ${response.status}`);
    }
    const raw = await response.json();
    if (!raw || typeof raw !== "object" || !raw.data || typeof raw.data !== "object" || raw.count < 1) {
      throw new Error("[getStations] Invalid or empty response structure from the server");
    }
    for (const key in raw.data) {
      const entry = raw.data[key];
      if (!isValidStationEntry(entry)) {
        console.warn(`[getStations] Invalid entry for key "${key}":`, entry);
        continue;
      }
      const id = entry[0];
      stations[id] = {
        id,
        code: entry[1],
        city: entry[3],
        lon: entry[7],
        lat: entry[8],
        network: entry[12],
        street: entry[17],
        number: entry[18],
        zipcode: entry[19]
      };
    }
    if (Object.keys(stations).length === 0) {
      throw new Error("No valid stations found");
    }
    return stations;
  } catch (error) {
    console.error("Error when calling up station data: ", error);
    throw error;
  }
  function isValidStationEntry(entry) {
    if (!Array.isArray(entry) || entry.length < 20) {
      return false;
    }
    const expectedStrings = [0, 1, 3, 7, 8, 12, 17, 18, 19];
    return expectedStrings.every((index) => typeof entry[index] === "string");
  }
}
async function getComponents() {
  const url = `${baseUrl}components/json?lang=de`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      throw new Error(`[getComponents] HTTP Error: ${response.status}`);
    }
    const raw = await response.json();
    if (!raw || typeof raw !== "object") {
      throw new Error("[getComponents] Unexpected response format");
    }
    const components = {};
    for (const key of Object.keys(raw)) {
      if (key === "count" || key === "indices") {
        continue;
      }
      const entry = raw[key];
      if (Array.isArray(entry) && entry.length >= 5) {
        const [id, code, symbol, unit, desc] = entry;
        components[id] = {
          id,
          code,
          symbol,
          unit,
          desc
        };
      } else {
        console.warn(`[getComponents] Invalid entry for key "${key}":`, entry);
      }
    }
    if (Object.keys(components).length === 0) {
      throw new Error("No valid components found");
    }
    return components;
  } catch (error) {
    console.error("Error when calling up the components:", error);
    throw error;
  }
}
async function getMeasurements(stationCode) {
  try {
    const urlSpec = "airquality/json?";
    const urlStation = prepareQueryParameters(stationCode);
    const url = [baseUrl, urlSpec, urlStation].join("");
    console.log("[getMeasurements] URL ", url);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      throw new Error(`[getMeasurements] HTTP-Fehler: ${response.status}`);
    }
    const measuresResponse = await response.json();
    if (!measuresResponse || typeof measuresResponse !== "object" || !measuresResponse.data || typeof measuresResponse.data !== "object") {
      throw new Error("Invalid or empty response");
    }
    for (const stationId of Object.keys(measuresResponse.data)) {
      const airQualityData = measuresResponse.data[stationId];
      if (typeof airQualityData !== "object" || !airQualityData) {
        continue;
      }
      if (measuresResponse.count < 1) {
        console.log("[#getMeasurements] NoData, empty");
        return { success: false };
      }
      for (const datetime of Object.keys(airQualityData)) {
        const entry = airQualityData[datetime];
        if (!Array.isArray(entry) || entry.length < 4) {
          console.warn(`[getMeasurements] Invalid entry for ${stationId} @ ${datetime}`);
          continue;
        }
        const [endTime, , , ...componentArrays] = entry;
        const result = {
          success: true,
          stationId,
          measurementTime: endTime,
          measurementValues: componentArrays
        };
        return result;
      }
    }
    return { success: false };
  } catch (error) {
    console.error("Error when calling up the measured values:", error);
    throw error;
  }
}
async function getMeasurementsComp(stationCode, component) {
  try {
    const urlSpec = "measures/json?";
    const urlStation = prepareQueryParameters(stationCode);
    const url = [baseUrl, urlSpec, urlStation, "&component=", component, "&scope=4"].join("");
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      throw new Error(`[getMeasurementsComp] HTTP-Fehler: ${response.status}`);
    }
    const measuresResponse = await response.json();
    if (!measuresResponse || typeof measuresResponse !== "object" || !measuresResponse.data || typeof measuresResponse.data !== "object") {
      throw new Error("Invalid or empty response");
    }
    for (const stationId of Object.keys(measuresResponse.data)) {
      const airQualityData = measuresResponse.data[stationId];
      if (typeof airQualityData !== "object" || !airQualityData) {
        continue;
      }
      for (const datetime of Object.keys(airQualityData)) {
        const entry = airQualityData[datetime];
        if (!Array.isArray(entry) || entry.length < 4) {
          console.warn(`[#getMeasurementsComp] Invalid entry for ${stationId} @ ${datetime}`);
          continue;
        }
        const [componentId, scopeId, value, endTime, index] = entry;
        const componentArray = [Number(componentId), value, scopeId, String(index)];
        const result = {
          success: true,
          stationId,
          measurementTime: String(endTime),
          measurementValues: [componentArray]
        };
        return result;
      }
    }
    return { success: false };
  } catch (error) {
    console.error("Error when calling up the measured values: ", error);
    throw error;
  }
}
function prepareQueryParameters(stationCode) {
  const parameters = [];
  const workDate = getDateUTC();
  const _hour = workDate.getHours();
  const _hourFrom = _hour < 1 ? 24 : _hour;
  const dateFrom = `date_from=${formatDate(workDate)}`;
  parameters.push(dateFrom);
  const timeFrom = `time_from=${String(_hourFrom)}`;
  parameters.push(timeFrom);
  const dateTo = `date_to=${formatDate(workDate)}`;
  parameters.push(dateTo);
  const timeTo = `time_to=${String(_hourFrom)}`;
  parameters.push(timeTo);
  if (stationCode != "") {
    parameters.push(`station=${stationCode}`);
  }
  const preparedQueryParameter = parameters.join("&");
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
  getMeasurementsComp,
  getStations
});
//# sourceMappingURL=api_calls.js.map
