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
class Airquality extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "airquality",
      useFormatDate: true
    });
    this.stationList = {};
    this.components = {};
    this.numberOfElements = 0;
    this.retryCount = 0;
    this.retryDelay = 2;
    this.maxRetries = 3;
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    await this.delay(Math.floor(Math.random() * 1e4));
    try {
      this.stationList = await (0, import_api_calls.getStations)();
    } catch (err) {
      this.log.error(`[onReady] Error when calling getStations: ${JSON.stringify(err)}`);
    }
    try {
      this.components = await (0, import_api_calls.getComponents)();
    } catch (err) {
      this.log.error(`[onReady] Error when calling getComponents: ${JSON.stringify(err)}`);
    }
    if (this.config.stations.length == 0) {
      this.log.info("[onReady] No stations specified");
      const home = this.getLocation();
      if (home.lat > 0) {
        const nearestStationIdx = this.findNearestStation(home, this.stationList);
        this.log.info(`[onReady] nearest Station Index: ${nearestStationIdx}`);
        await this.writeStationToConfig(this.stationList[nearestStationIdx].code);
      }
    }
    await this.controller();
  }
  /**
   * controller
   */
  async controller() {
    try {
      const data = await this.worker();
      if (data) {
        this.log.info("[controller] Data retrieved successfully.");
        await this.setState("info.lastUpdate", { val: Date.now(), ack: true });
        this.stopAdapter();
      } else {
        throw new Error("No data received.");
      }
    } catch (err) {
      this.retryCount++;
      this.log.warn(
        `[controller] Retrieval failed (attempt ${this.retryCount}/${this.maxRetries}): ${String(err)}`
      );
      if (this.retryCount < this.maxRetries) {
        this.log.info(`[controller] New attempt in ${this.retryDelay} minutes...`);
        this.timeoutId = setTimeout(() => this.controller(), this.retryDelay * 6e4);
      } else {
        this.log.silly("[controller] Maximum number of attempts reached. Adapter will terminated.");
        this.stopAdapter();
      }
    }
  }
  /**
   * worker function to call data from the selected stations
   */
  async worker() {
    const selectedStations = this.config.stations;
    this.log.info(`[worker] Attempting to call data from the selected stations: ${selectedStations}`);
    let success = false;
    try {
      for (const station of selectedStations) {
        await this.delay(Math.floor(Math.random() * 1e3));
        this.log.debug(`[worker] fetches data from ${station}`);
        this.numberOfElements = 0;
        const measurement = await (0, import_api_calls.getMeasurements)(station);
        if (measurement.success) {
          await this.parseData(measurement);
          success = measurement.success;
        }
        const measurementComp = await (0, import_api_calls.getMeasurementsComp)(station, 2);
        if (measurementComp.success) {
          await this.parseData(measurementComp);
        }
      }
      return success;
    } catch (error) {
      if (error instanceof Error) {
        this.log.error(`[worker] Error: ${error.message}`);
      } else {
        this.log.error(`[worker] Unknown error: ${JSON.stringify(error)}`);
      }
      return false;
    }
  }
  /**
   * Persist the measurements
   *
   * @param station Station Code
   * @param sensor Sensor
   * @param name Description
   * @param value Value
   * @param unit Unit
   * @param role Role
   */
  async persistData(station, sensor, name, value, unit, role) {
    const dp_Sensor = `${this.removeInvalidCharacters(station)}.${this.removeInvalidCharacters(sensor)}`;
    this.log.silly(
      `[persistData] Station "${station}"  Sensor "${sensor}"  Desc "${name}" with value: "${value}" and unit "${unit}" as role "${role}"`
    );
    if (isNumber(value)) {
      await this.setObjectNotExistsAsync(dp_Sensor, {
        type: "state",
        common: {
          name,
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
          name,
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
  /**
   *	Store metadata for the station
   *
   * @param station Station Code
   * @param valueNMT Number of measurement types
   * @param valueTLM Time of the last measurement
   */
  async storeData(station, valueNMT, valueTLM) {
    const dp_Station = this.removeInvalidCharacters(station);
    const dp_SensorNMT = `${dp_Station}._NMT`;
    this.log.silly(`[storeData] Station "${station}", Sensor "_NMT" with value: "${valueNMT}"`);
    await this.setObjectNotExistsAsync(dp_SensorNMT, {
      type: "state",
      common: {
        name: {
          en: "Number of measurement types",
          de: "Anzahl der Messarten",
          ru: "\u0427\u0438\u0441\u043B\u043E \u0442\u0438\u043F\u043E\u0432 \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0439",
          pt: "N\xFAmero de tipos de medi\xE7\xE3o",
          nl: "Aantal meettypes",
          fr: "Nombre de types de mesure",
          it: "Numero di tipi di misura",
          es: "N\xFAmero de tipos de medici\xF3n",
          pl: "Liczba typ\xF3w pomiar\xF3w",
          uk: "\u041A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C \u0442\u0438\u043F\u0456\u0432 \u0432\u0438\u043C\u0456\u0440\u044E\u0432\u0430\u043D\u043D\u044F",
          "zh-cn": "\u8BA1\u91CF\u7C7B\u578B\u6570\u76EE"
        },
        type: "number",
        role: "value",
        unit: "",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setState(dp_SensorNMT, { val: valueNMT, ack: true, q: 0 });
    const dp_SensorTLM = `${dp_Station}._TLM`;
    this.log.silly(`[storeData] Station "${station}", Sensor "_TLM" with value: "${valueTLM}"`);
    await this.setObjectNotExistsAsync(dp_SensorTLM, {
      type: "state",
      common: {
        name: {
          en: "Time of the last measurement",
          de: "Zeit der letzten Messung",
          ru: "\u0412\u0440\u0435\u043C\u044F \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0433\u043E \u0438\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u044F",
          pt: "Tempo da \xFAltima medi\xE7\xE3o",
          nl: "Tijd van de laatste meting",
          fr: "Dur\xE9e de la derni\xE8re mesure",
          it: "Tempo dell' ultima misura",
          es: "Tiempo de la \xFAltima medici\xF3n",
          pl: "Czas ostatniego pomiaru",
          uk: "\u0427\u0430\u0441 \u043E\u0441\u0442\u0430\u043D\u043D\u044C\u043E\u0433\u043E \u0432\u0438\u043C\u0456\u0440\u044E\u0432\u0430\u043D\u043D\u044F",
          "zh-cn": "\u4E0A\u6B21\u6D4B\u91CF\u7684\u65F6\u95F4"
        },
        type: "string",
        role: "text",
        unit: "",
        read: true,
        write: false
      },
      native: {}
    });
    await this.setState(dp_SensorTLM, { val: valueTLM, ack: true, q: 0 });
  }
  /**
   * Retrieves the desired data from the payload and prepares data for storage
   *
   * @param {} payload Object from Response
   //* @returns Data to persist
   */
  async parseData(payload) {
    this.log.debug(`[parseData] Payload: ${JSON.stringify(payload)}`);
    if (Object.keys(payload).length === 0) {
      this.log.debug("[#parseData] Payload ist leer");
      return;
    }
    const localDate = /* @__PURE__ */ new Date();
    const summerOffset = localDate.getTimezoneOffset() / 60;
    const stationId = payload.stationId;
    const timeEndAdjusted = this.correctHour(payload.measurementTime, summerOffset * -1 - 1);
    for (const item of Object.keys(payload.measurementValues)) {
      const measurement = payload.measurementValues[item];
      await this.persistData(
        this.stationList[stationId].code,
        this.components[measurement[0]].code,
        this.components[measurement[0]].desc,
        measurement[1],
        // Value
        this.components[measurement[0]].unit,
        "value"
      );
      this.numberOfElements++;
    }
    if (this.numberOfElements > 0) {
      await this.storeData(this.stationList[stationId].code, this.numberOfElements, timeEndAdjusted);
    }
    this.log.debug(`[parseData] Measured values from ${this.numberOfElements} sensors determined`);
    return;
  }
  /**
   * Use the specified coordinates from the configuration
   *
   * @returns Koordinates(lat, lon)
   */
  getLocation() {
    if (this.latitude == void 0 || this.latitude == 0 || this.longitude == void 0 || this.longitude == 0) {
      this.log.warn(
        'longitude/latitude not set in system-config - please check instance configuration of "System settings"'
      );
      return { lat: -1, lon: -1 };
    }
    this.log.debug(`[getLocation] using Latitude: ${this.latitude} and Longitude: ${this.longitude}`);
    return { lat: this.latitude, lon: this.longitude };
  }
  /**
   * search for the nearest station using coordinates
   *
   * @param localHome Koordinates from system
   * @param coordinates Koordinates from stations
   * @returns stationId
   */
  findNearestStation(localHome, coordinates) {
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
      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = parseInt(key);
      }
    }
    this.log.debug(`[findNearestStation]: >>> Station Idx: ${nearestStation}`);
    return nearestStation;
  }
  /**
   * write code of Station in UI-config
   *
   * @param localStation code of mesurement station
   */
  async writeStationToConfig(localStation) {
    const _station = [];
    await this.getForeignObject(`system.adapter.${this.namespace}`, (err, obj) => {
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
  /**
   * calculates the distance between two coordinates using the Haversine formula
   *
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
   *
   * @param inputString Designated name for an object/data point
   * @returns Cleaned name for an object/data point
   */
  removeInvalidCharacters(inputString) {
    const regexPattern = "[^a-zA-Z0-9]+";
    const regex = new RegExp(regexPattern, "gu");
    return inputString.replace(regex, "_");
  }
  /**
   * correct datestring from datestring by adding x hours (offset)
   *
   * @param s Datestring
   * @param offset Offset
   * @returns String with Date & Time
   */
  correctHour(s, offset) {
    const dateString = s.split(" ")[0].split("-");
    const sDate = `${dateString[2]}.${dateString[1]}.${dateString[0]}`;
    const timeString = s.split(" ")[1].split(":");
    const hour = parseInt(timeString[0]) + offset;
    const sHour = hour.toString().padStart(2, "0");
    const sTime = `${sHour}:${timeString[1]}`;
    return `${sDate} ${sTime}`;
  }
  /**
   * my own methode to stop an adapter
   */
  stopAdapter() {
    this.terminate ? this.terminate("Everything done. Finished till next schedule", 11) : process.exit(0);
  }
  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   *
   * @param callback Callback
   */
  onUnload(callback) {
    try {
      if (this.timeoutId != void 0) {
        clearTimeout(this.timeoutId);
        this.timeoutId = void 0;
      }
      callback();
    } catch (e) {
      this.log.debug(`[onUnload] ${JSON.stringify(e)}`);
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
