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
const fileHandle = { path: "logs/airquality", file: "logs.txt" };
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
  //public summerOffset: number = 0;
  instanceDir = utils.getAbsoluteInstanceDataDir(this);
  //public fileHandle = { path: './logs/airquality', file: 'logs.txt' };
  //console.log('InstanceDir: ', instanceDir);
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    this.log.info("Latitude: " + this.latitude);
    this.log.info("Longitude: " + this.longitude);
    this.log.info("config stations: " + this.config.stations);
    const dataDir = utils.getAbsoluteDefaultDataDir();
    this.log.info("DataDir: " + dataDir);
    fileHandle.path = dataDir + fileHandle.path;
    this.log.info("New Path: " + fileHandle.path);
    const executionInterval = 15;
    this.stationList = await (0, import_api_calls.getStations)();
    this.components = await (0, import_api_calls.getComponents)();
    if (this.config.stations.length === 0) {
      this.log.info("[onReady] No stations specified");
      const home = await this.getLocation();
      if (home.lat > 0) {
        const nearestStationIdx = await this.findNearestStation(home, this.stationList);
        this.log.info(`[onReady] nearestStationIdx: ${nearestStationIdx}`);
        await this.writeStationToConfig(this.stationList[nearestStationIdx].code);
      }
    } else {
      console.log("Start");
      await this.loop();
      this.updateInterval = this.setInterval(async () => {
        console.log(this.config.stations);
        await this.loop();
      }, executionInterval * 6e4);
    }
  }
  /**
   * This loop is executed cyclically
   */
  async loop() {
    const selectedStations = await this.checkStationInput();
    try {
      for (const station of selectedStations) {
        const measurement = await (0, import_api_calls.getMeasurements)(station);
        await this.parseData(measurement);
      }
      await this.setState("info.lastUpdate", { val: Date.now(), ack: true });
    } catch (error) {
      this.setState("info.connection", { val: false, ack: true });
      if (error instanceof Error) {
        this.log.error("[loop] Error: " + error.message);
      } else {
        this.log.error("[loop] Unknown error: " + error);
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
  //
  /**
   * Checks if station in config available
   * @returns selectedStations
   */
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
    if (this.latitude == void 0 || this.latitude == 0 || this.longitude == void 0 || this.longitude == 0) {
      this.log.warn(
        'longitude/latitude not set in system-config - please check instance configuration of "System settings"'
      );
      return { lat: -1, lon: -1 };
    } else {
      this.log.debug(`[getLocation] using Latitude: ${this.latitude} and Longitude: ${this.longitude}`);
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
   * @param {string} location
   */
  async createObject(station, description, location) {
    const dp_Folder = this.removeInvalidCharacters(station);
    this.log.debug(`[createObject] Folder: ${dp_Folder}`);
    await this.setObjectNotExists(dp_Folder, {
      type: "folder",
      common: {
        name: {
          en: "Measurements from station",
          de: "Messungen von Station",
          ru: "\u0418\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F \u043D\u0430 \u0441\u0442\u0430\u043D\u0446\u0438\u0438",
          pt: "Medi\xE7\xF5es da esta\xE7\xE3o",
          nl: "Metingen vanaf het station",
          fr: "Mesures de la station",
          it: "Misure dalla stazione",
          es: "Medidas desde la estaci\xF3n",
          pl: "Pomiary ze stacji",
          uk: "\u0412\u0438\u043C\u0456\u0440\u044E\u0432\u0430\u043D\u043D\u044F \u0437 \u0441\u0442\u0430\u043D\u0446\u0456\u0457",
          "zh-cn": "\u4ECE\u8F66\u7AD9\u6D4B\u91CF"
        },
        desc: description + "> " + location,
        role: "info"
      },
      native: {}
    });
    this.log.debug(`[createObject] Station "${station}" City "${description}"`);
  }
  /**
   * calculates the distance between two coordinates using the Haversine formula
   * @param lat1 Latitude of the place of residence
   * @param lon1 Longitude of the place of residence
   * @param lat2 Latitude of the station
   * @param lon2 Longitude of the station
   * @returns Distance to the station
   */
  getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
    function deg2rad(deg) {
      return deg * (Math.PI / 180);
    }
  }
  /**
   * removes illegal characters
   * @param inputString Designated name for an object/data point
   * @returns Cleaned name for an object/data point
   */
  removeInvalidCharacters(inputString) {
    const regexPattern = "[^a-zA-Z0-9]+";
    const regex = new RegExp(regexPattern, "gu");
    return inputString.replace(regex, "_");
  }
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
      this.log.debug(`[onUnload] e ${e}`);
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
