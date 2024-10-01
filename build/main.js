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
var utils = __toESM(require("@iobroker/adapter-core"));
var import_api_calls = require("./lib/api_calls");
var import_filelogger = require("./lib/filelogger");
var import_helper_time = require("./lib/helper_time");
const fileHandle = { path: "./logs/airquality", file: "logs.txt" };
class Airquality extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "airquality",
      useFormatDate: true
    });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  updateInterval = void 0;
  stationList = {};
  components = {};
  summerOffset = 0;
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    this.log.info("Latitude: " + this.latitude);
    this.log.info("Longitude: " + this.longitude);
    this.log.info("config stations: " + this.config.stations);
    const executionInterval = 15;
    this.stationList = await (0, import_api_calls.getStations)();
    console.log(this.stationList[931].city);
    this.components = await (0, import_api_calls.getComponents)();
    console.log(this.components[6].desc);
    if (this.config.stations.length === 0) {
      console.log("No Stations");
      const home = await this.getLocation();
      const nearestStationIdx = await this.findNearestStation(home, this.stationList);
      console.log(`nearestStationIdx: ${nearestStationIdx}`);
      await this.writeStationToConfig(this.stationList[nearestStationIdx].code);
    } else {
      console.log("Start");
      await this.loop();
      this.updateInterval = this.setInterval(async () => {
        console.log(this.config.stations);
        await this.loop();
        console.log(`Moep: ${this.updateInterval}`);
      }, executionInterval * 6e4);
    }
  }
  async loop() {
    console.log("### LOOP ###");
    const selectedStations = await this.checkStationInput();
    try {
      for (const station of selectedStations) {
        const measurement = await (0, import_api_calls.getMeasurements)(station);
        await this.parseData(measurement);
        console.log("==========");
      }
      await this.setState("info.lastUpdate", { val: Date.now(), ack: true });
    } catch (error) {
      this.setState("info.connection", { val: false, ack: true });
      if (error instanceof Error) {
        this.log.error("[loop] Fehler: " + error.message);
      } else {
        this.log.error("[loop] Unbekannter Fehler: " + error);
      }
    }
  }
  /**
   * Persist the measurements
   * @param {string} station
   * @param {string} sensor
   * @param {string} description
   * @param {number} value
   * @param {string} unit
   * @param {string} role
   */
  async persistData(station, sensor, description, value, unit, role) {
    const dp_Sensor = this.removeInvalidCharacters(station) + "." + this.removeInvalidCharacters(sensor);
    this.log.silly(
      `[persistData] Station "${station}"  Sensor "${sensor}"  Desc "${description}" with value: "${value}" and unit "${unit}" as role "${role}`
    );
    if (isNumber(value)) {
      await this.setObjectNotExistsAsync(dp_Sensor, {
        type: "state",
        common: {
          name: description,
          type: "number",
          role,
          unit,
          read: true,
          write: false
        },
        native: {}
      });
    } else {
      await this.setObjectNotExistsAsync(dp_Sensor, {
        type: "state",
        common: {
          name: description,
          type: "string",
          role,
          unit,
          read: true,
          write: false
        },
        native: {}
      });
    }
    await this.setState(dp_Sensor, { val: value, ack: true, q: 0 });
    function isNumber(n) {
      return !isNaN(parseFloat(n)) && !isNaN(n - 0);
    }
  }
  //
  /**
   * Retrieves the desired data from the payload and prepares data for storage
   * @param {*} payload Object from Response
   * @returns
   */
  async parseData(payload) {
    this.log.debug(`[parseData] Payload: ${JSON.stringify(payload)}`);
    (0, import_filelogger.writeLog)(fileHandle, JSON.stringify(payload));
    if (Object.keys(payload).length === 0) {
      this.log.warn("No data received");
      return;
    }
    const localDate = /* @__PURE__ */ new Date();
    const summerOffset = localDate.getTimezoneOffset() / 60;
    console.log(`LocalDate: Offset ${summerOffset}`);
    const stationId = parseInt(Object.keys(payload)[0]);
    await this.createObject(
      this.stationList[stationId].code,
      this.stationList[stationId].city,
      this.stationList[stationId].street
    );
    const innerObject = payload[stationId];
    const dateTimeStart = Object.keys(innerObject)[0];
    const dateTimeEnd = innerObject[dateTimeStart][0];
    const bisTime = (0, import_helper_time.correctHour)(dateTimeEnd, summerOffset * -1 - 1);
    console.log("bisTime: ", bisTime);
    let innerData;
    let nArray = 0;
    for (const element in innerObject) {
      innerData = innerObject[element];
      console.log("inner: ", innerData);
      for (const element2 in innerData) {
        if (Array.isArray(innerData[element2])) {
          nArray++;
          console.log(innerData[element2]);
          const typeMeasurement = innerData[element2][0];
          console.log(`typeMeasurement=${typeMeasurement} ==> ${this.components[typeMeasurement].name}`);
          await this.persistData(
            this.stationList[stationId].code,
            this.components[typeMeasurement].name,
            this.components[typeMeasurement].desc,
            innerData[element2][1],
            // Value
            this.components[typeMeasurement].unit,
            "state"
          );
        }
      }
    }
    if (nArray > 0) {
      this.persistData(
        this.stationList[stationId].code,
        "Letzte Messung",
        "Zeitspanne der letzten Messung",
        bisTime,
        "",
        "string"
      );
      this.persistData(
        this.stationList[stationId].code,
        "Anzahl Messtypen",
        "Zahl der zuletzt gemessenen Typen",
        nArray,
        "",
        "number"
      );
    }
    this.log.debug(`[parseData] Measured values from ${nArray} sensors determined`);
  }
  //	########################
  testQueryParameters() {
    const d = /* @__PURE__ */ new Date();
    console.log(d);
    for (let h = 0; h < 24; h++) {
      console.log(h, new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, d.getMinutes(), d.getSeconds()));
    }
  }
  //	########################
  //
  async checkStationInput() {
    const selectedStations = this.config.stations;
    console.log("Selected Stations: " + selectedStations);
    console.log(Array.isArray(selectedStations));
    return selectedStations;
  }
  //
  /**
   * Use the specified coordinates from the configuration
   * @returns {object} Koordinates(lat, lon)
   */
  async getLocation() {
    this.log.debug("[getLocation] try to use the location from the system configuration");
    if (this.latitude == void 0 || this.longitude == void 0) {
      this.log.warn(
        'longitude/latitude not set in system-config - please check instance configuration of "System settings"'
      );
      return {};
    } else {
      this.log.debug(`[getLocation] using Latitude: ${this.latitude} and Longitude: ${this.longitude}`);
      if (isNaN(this.latitude))
        console.log("Latitude Moep");
      return { lat: this.latitude, lon: this.longitude };
    }
  }
  //
  /**
   * search for the nearest station using coordinates
   * @param {object} localHome
   * @param {object} coordinates
   * @returns {number} stationId
   */
  async findNearestStation(localHome, coordinates) {
    let minDistance = Number.MAX_VALUE;
    let nearestStation = 0;
    this.log.debug(`[findNearestStation]: Latitude: ${localHome.lat} Longitude: ${localHome.lon}`);
    for (const key of Object.keys(coordinates)) {
      const distance = this.getDistanceFromLatLonInKm(
        localHome.lat,
        localHome.lon,
        parseFloat(coordinates[key].lat),
        parseFloat(coordinates[key].lon)
      );
      this.log.silly(`Distance: ${key} ${distance}`);
      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = parseInt(key);
      }
    }
    this.log.debug(`[findNearestStation]: >>> Station ID: ${nearestStation}`);
    return nearestStation;
  }
  //
  /**
   * write code of Station in UI-config
   * @param {string} localStation code of mesurement station
   */
  async writeStationToConfig(localStation) {
    const _station = [];
    return;
    this.getForeignObject("system.adapter." + this.namespace, (err, obj) => {
      if (err) {
        this.log.error(`[writeStationToConfig] ${err}`);
      } else {
        if (obj) {
          _station.push(localStation);
          obj.native.stations = _station;
          this.setForeignObject(obj._id, obj, (err2) => {
            if (err2) {
              this.log.error(`[writeStationToConfig] Error when writing in config: ${err2}`);
            } else {
              this.log.debug(`[writeStationToConfig] New Station in config: ${localStation}`);
            }
          });
        }
      }
    });
  }
  //
  /**
   * Create a folder für station
   * @param {string} station
   * @param {string} description
   */
  async createObject(station, description, location) {
    const dp_Folder = this.removeInvalidCharacters(station);
    this.log.debug(`[createObject] Folder: ${dp_Folder}`);
    await this.setObjectNotExists(dp_Folder, {
      type: "folder",
      common: {
        name: "Measurements from station",
        desc: description + "> " + location,
        role: "info"
      },
      native: {}
    });
    this.log.debug(`[createObject] Station "${station}" City "${description}"`);
  }
  //
  //__________________________
  // removes illegal characters
  removeInvalidCharacters(inputString) {
    const regexPattern = "[^a-zA-Z0-9]+";
    const regex = new RegExp(regexPattern, "gu");
    return inputString.replace(regex, "_");
  }
  //__________________________
  // calculates the distance between two coordinates using the Haversine formula
  getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
  }
  //__________________________
  // Convert to radians
  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }
  //
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  onUnload(callback) {
    try {
      if (this.updateInterval) {
        this.clearInterval(this.updateInterval);
      }
      callback();
    } catch (e) {
      callback();
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new Airquality(options);
} else {
  (() => new Airquality())();
}
//# sourceMappingURL=main.js.map
