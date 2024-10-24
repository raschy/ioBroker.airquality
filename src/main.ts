'use strict';
/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
// Load your modules here, e.g.:
import { getComponents, getMeasurements, getStations } from './lib/api_calls';
//#import { writeLog } from './lib/filelogger';
//#import { correctHour } from './lib/helper_time';
//const instanceDir = utils.getAbsoluteInstanceDataDir(this);
const fileHandle = { path: 'logs/airquality', file: 'logs.txt' };

class Airquality extends utils.Adapter {
	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'airquality',
			useFormatDate: true,
		});
		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}
	public updateInterval: ioBroker.Interval | undefined = undefined;
	public stationList: Stations = {};
	public components: Components = {};
	//public summerOffset: number = 0;
	public instanceDir: string = utils.getAbsoluteInstanceDataDir(this);
	//public fileHandle = { path: './logs/airquality', file: 'logs.txt' };
	//console.log('InstanceDir: ', instanceDir);

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.info('Latitude: ' + this.latitude);
		this.log.info('Longitude: ' + this.longitude);
		this.log.info('config stations: ' + this.config.stations);
		//
		const dataDir: string = utils.getAbsoluteDefaultDataDir();
		this.log.info('DataDir: ' + dataDir);
		fileHandle.path = dataDir + fileHandle.path;
		this.log.info('NewPath: ' + fileHandle.path);
		//
		// -----------------  Timeout variables -----------------
		const executionInterval: number = 15; // => minutes
		//
		this.stationList = await getStations();
		//console.log(this.stationList[931].city); //> 'Lingen'
		//
		this.components = await getComponents();
		//console.log(this.components[6].desc); //> 'Blei im Feinstaub'
		//
		if (this.config.stations.length === 0) {
			this.log.info('[onReady] No stations specified');
			// if no station is selected in config
			const home: Home = await this.getLocation();
			if (home.lat > 0) {
				const nearestStationIdx: number = await this.findNearestStation(home, this.stationList);
				this.log.info(`[onReady] nearestStationIdx: ${nearestStationIdx}`);
				await this.writeStationToConfig(this.stationList[nearestStationIdx].code);
			}
			//
		} else {
			console.log('Start');
			await this.loop();
			this.updateInterval = this.setInterval(async () => {
				console.log(this.config.stations);
				await this.loop();
			}, executionInterval * 60000);
		}
	}

	/**
	 * This loop is executed cyclically
	 */
	async loop(): Promise<any> {
		const selectedStations = await this.checkStationInput();
		//
		try {
			for (const station of selectedStations) {
				const measurement = await getMeasurements(station);
				await this.parseData(measurement);
			}
			await this.setState('info.lastUpdate', { val: Date.now(), ack: true });
		} catch (error: unknown) {
			this.setState('info.connection', { val: false, ack: true });
			if (error instanceof Error) {
				this.log.error('[loop] Error: ' + error.message);
			} else {
				this.log.error('[loop] Unknown error: ' + error);
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
	async persistData(
		station: string,
		sensor: string,
		description: string,
		value: number | string,
		unit: string,
		role: string,
	): Promise<void> {
		const dp_Sensor = this.removeInvalidCharacters(station) + '.' + this.removeInvalidCharacters(sensor);
		this.log.silly(
			`[persistData] Station "${station}"  Sensor "${sensor}"  Desc "${description}" with value: "${value}" and unit "${unit}" as role "${role}`,
		);
		//
		if (isNumber(value)) {
			//value = parseFloat(value);
			await this.setObjectNotExistsAsync(dp_Sensor, {
				type: 'state',
				common: {
					name: description,
					type: 'number',
					role: role,
					unit: unit,
					read: true,
					write: false,
				},
				native: {},
			});
		} else {
			// or <string>
			await this.setObjectNotExistsAsync(dp_Sensor, {
				type: 'state',
				common: {
					name: description,
					type: 'string',
					role: role,
					unit: unit,
					read: true,
					write: false,
				},
				native: {},
			});
		}
		//
		//console.log('Write:', dp_Sensor);
		await this.setState(dp_Sensor, { val: value, ack: true, q: 0x00 });
		//
		function isNumber(n: any): boolean {
			return !isNaN(parseFloat(n)) && !isNaN(n - 0);
		}
	}
	//
	/**
	 * Retrieves the desired data from the payload and prepares data for storage
	 * @param {*} payload Object from Response
	 * @returns
	 */
	async parseData(payload: any): Promise<any> {
		this.log.debug(`[parseData] Payload: ${JSON.stringify(payload)}`);
		if (Object.keys(payload).length === 0) {
			this.log.warn('No data received');
			return;
		}
		//
		const localDate = new Date();
		const summerOffset = localDate.getTimezoneOffset() / 60;
		console.log(`LocalDate: Offset ${summerOffset}`);
		//
		const stationId: number = parseInt(Object.keys(payload)[0]);
		await this.createObject(
			this.stationList[stationId].code,
			this.stationList[stationId].city,
			this.stationList[stationId].street,
		);
		//
		const innerObject = payload[stationId];
		const dateTimeStart = Object.keys(innerObject)[0];
		const dateTimeEnd: string = innerObject[dateTimeStart][0];
		const bisTime: string = correctHour(dateTimeEnd, summerOffset * -1 - 1);
		console.log('bisTime: ', bisTime);
		//
		let innerData;
		let numberOfElements = 0;
		for (const element in innerObject) {
			innerData = innerObject[element];
			console.log('inner: ', innerData);

			for (const element in innerData) {
				//console.log('Element: ', element);
				if (Array.isArray(innerData[element])) {
					numberOfElements++;
					console.log(innerData[element]);
					const typeMeasurement = innerData[element][0];
					console.log(`typeMeasurement=${typeMeasurement} ==> ${this.components[typeMeasurement].name}`);
					await this.persistData(
						this.stationList[stationId].code,
						this.components[typeMeasurement].name,
						this.components[typeMeasurement].desc,
						innerData[element][1], // Value
						this.components[typeMeasurement].unit,
						'state',
					);
				}
			}
		}
		if (numberOfElements > 0) {
			this.persistData(
				this.stationList[stationId].code,
				'Letzte Messung',
				'Zeitspanne der letzten Messung',
				bisTime,
				'',
				'string',
			);
			this.persistData(
				this.stationList[stationId].code,
				'Anzahl Messtypen',
				'Zahl der zuletzt gemessenen Typen',
				numberOfElements,
				'',
				'number',
			);
		}
		this.log.debug(`[parseData] Measured values from ${numberOfElements} sensors determined`);
		//__________________________
		// correct datestring from datestring by adding 1 hour
		function correctHour(s: string, offset: number): string {
			const dateString = s.split(' ')[0].split('-');
			const sDate = dateString[2] + '.' + dateString[1] + '.' + dateString[0];
			//
			const timeString = s.split(' ')[1].split(':');
			const hour = parseInt(timeString[0]) + offset; //Korrektur
			const sHour = hour.toString().padStart(2, '0');
			const sTime = sHour + ':' + timeString[1] + ' Uhr';
			return `${sDate} ${sTime}`;
		}
	}

	//
	/**
	 * Checks if station in config available
	 * @returns selectedStations
	 */
	async checkStationInput(): Promise<any> {
		const selectedStations = this.config.stations;
		console.log('Selected Stations: ' + selectedStations);
		console.log(Array.isArray(selectedStations));
		return selectedStations;
	}
	//
	/**
	 * Use the specified coordinates from the configuration
	 * @returns {object} Koordinates(lat, lon)
	 */
	async getLocation(): Promise<any> {
		this.log.debug('[getLocation] try to use the location from the system configuration');
		if (this.latitude == undefined || this.latitude == 0 || this.longitude == undefined || this.longitude == 0) {
			this.log.warn(
				'longitude/latitude not set in system-config - please check instance configuration of "System settings"',
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
	async findNearestStation(localHome: Home, coordinates: Stations): Promise<number> {
		let minDistance: number = Number.MAX_VALUE;
		let nearestStation: number = 0;
		this.log.debug(`[findNearestStation]: Latitude: ${localHome.lat} Longitude: ${localHome.lon}`);
		//
		for (const key of Object.keys(coordinates)) {
			const distance = this.getDistanceFromLatLonInKm(
				localHome.lat,
				localHome.lon,
				parseFloat(coordinates[key].lat),
				parseFloat(coordinates[key].lon),
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
	async writeStationToConfig(localStation: string): Promise<void> {
		//console.log(`[writeStationToConfig] ${localStation}`);
		const _station: Array<string> = [];
		return; // only for testing
		this.getForeignObject('system.adapter.' + this.namespace, (err, obj) => {
			if (err) {
				this.log.error(`[writeStationToConfig] ${err}`);
			} else {
				if (obj) {
					_station.push(localStation); // must be an array
					obj.native.stations = _station; // modify object
					this.setForeignObject(obj._id, obj, (err) => {
						if (err) {
							this.log.error(`[writeStationToConfig] Error when writing in config: ${err}`);
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
	async createObject(station: string, description: string, location: string): Promise<void> {
		const dp_Folder = this.removeInvalidCharacters(station);
		if (await this.objectExists(dp_Folder)) return;
		//
		await this.setObjectNotExists(dp_Folder, {
			type: 'folder',
			common: {
				name: {
					en: 'Measurements from station',
					de: 'Messungen von Station',
					ru: 'Измерения на станции',
					pt: 'Medições da estação',
					nl: 'Metingen vanaf het station',
					fr: 'Mesures de la station',
					it: 'Misure dalla stazione',
					es: 'Medidas desde la estación',
					pl: 'Pomiary ze stacji',
					uk: 'Вимірювання з станції',
					'zh-cn': '从车站测量',
				},
				desc: description + '> ' + location,
				role: 'info',
			},
			native: {},
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
	getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371; // Radius of the earth in kilometres
		const dLat = deg2rad(lat2 - lat1);
		const dLon = deg2rad(lon2 - lon1);
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const d = R * c; // Distance in km
		return d;
		// Convert to radians
		function deg2rad(deg: number): number {
			return deg * (Math.PI / 180);
		}
	}

	/**
	 * removes illegal characters
	 * @param inputString Designated name for an object/data point
	 * @returns Cleaned name for an object/data point
	 */
	removeInvalidCharacters(inputString: string): string {
		const regexPattern = '[^a-zA-Z0-9]+';
		const regex = new RegExp(regexPattern, 'gu');
		return inputString.replace(regex, '_');
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private onUnload(callback: () => void): void {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			if (this.updateInterval) {
				this.clearInterval(this.updateInterval);
			}
			callback();
			/*eslint no-unused-vars: ["error", { "caughtErrors": "none" }]*/
		} catch (e) {
			this.log.debug(`[onUnload] e ${e}`); //eslint no-unused-vars
			callback();
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Airquality(options);
} else {
	// otherwise start the instance directly
	(() => new Airquality())();
}
