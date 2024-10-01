/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import { getComponents, getMeasurements, getStations } from './lib/api_calls';
import { writeLog } from './lib/filelogger';
import { correctHour } from './lib/helper_time';
const fileHandle = { path: './logs/airquality', file: 'logs.txt' };

// Load your modules here, e.g.:
// import * as fs from "fs";

class Airquality extends utils.Adapter {
	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'airquality',
			useFormatDate: true,
		});
		this.on('ready', this.onReady.bind(this));
		// this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}
	public updateInterval: ioBroker.Interval | undefined = undefined;
	public stationList: Stations = {};
	public components: Components = {};
	public summerOffset: number = 0;

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
		// -----------------  Timeout variables -----------------
		const executionInterval: number = 15; // => minutes
		//
		this.stationList = await getStations();
		console.log(this.stationList[931].city); //> 'Lingen'
		//
		this.components = await getComponents();
		console.log(this.components[6].desc); //> 'Blei im Feinstaub'
		//
		if (this.config.stations.length === 0) {
			console.log('No Stations');
			// if no station is selected in config
			const home: Home = await this.getLocation();
			if (home) {
				const nearestStationIdx: number = await this.findNearestStation(home, this.stationList);
				console.log(`nearestStationIdx: ${nearestStationIdx}`);
				//await this.writeStationToConfig(this.stationList[nearestStationIdx].code);
			}
			//
		} else {
			console.log('Start');
			await this.loop();
			this.updateInterval = this.setInterval(async () => {
				console.log(this.config.stations);
				await this.loop();
				console.log(`Moep: ${this.updateInterval}`);
			}, executionInterval * 60000);
		}
	}

	async loop(): Promise<any> {
		console.log('### LOOP ###');
		const selectedStations = await this.checkStationInput();
		//
		try {
			for (const station of selectedStations) {
				const measurement = await getMeasurements(station);
				await this.parseData(measurement);
				console.log('==========');
			}
			await this.setState('info.lastUpdate', { val: Date.now(), ack: true });
		} catch (error: unknown) {
			this.setState('info.connection', { val: false, ack: true });
			if (error instanceof Error) {
				this.log.error('[loop] Fehler: ' + error.message);
			} else {
				this.log.error('[loop] Unbekannter Fehler: ' + error);
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
		writeLog(fileHandle, JSON.stringify(payload));
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
		let nArray = 0;
		for (const element in innerObject) {
			innerData = innerObject[element];
			console.log('inner: ', innerData);

			for (const element in innerData) {
				//console.log('Element: ', element);
				if (Array.isArray(innerData[element])) {
					nArray++;
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
		if (nArray > 0) {
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
				nArray,
				'',
				'number',
			);
		}
		this.log.debug(`[parseData] Measured values from ${nArray} sensors determined`);
	}
	//	########################
	testQueryParameters(): void {
		const d = new Date();
		console.log(d);
		for (let h: number = 0; h < 24; h++) {
			//const yDate: Date = buildDate(h);
			console.log(h, new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, d.getMinutes(), d.getSeconds()));
			//console.log(h, yDate);
		}
	}
	//	########################

	//
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
		if (this.latitude == undefined || this.longitude == undefined) {
			this.log.warn(
				'longitude/latitude not set in system-config - please check instance configuration of "System settings"',
			);
			return {};
		} else {
			this.log.debug(`[getLocation] using Latitude: ${this.latitude} and Longitude: ${this.longitude}`);
			if (isNaN(this.latitude)) console.log('Latitude Moep');
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
			//console.log(`${key}: ${JSON.stringify(coordinates[key as keyof typeof coordinates])}`);
			//console.log(`${key}: ${coordinates[key].lat} # ${coordinates[key].lon}`);
			const distance = this.getDistanceFromLatLonInKm(
				localHome.lat,
				localHome.lon,
				parseFloat(coordinates[key].lat),
				parseFloat(coordinates[key].lon),
			);
			this.log.silly(`Distance: ${key} ${distance}`);
			//console.log(`Distance: ${key} ${distance}`);
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
	 */
	async createObject(station: string, description: string, location: string): Promise<void> {
		const dp_Folder = this.removeInvalidCharacters(station);
		this.log.debug(`[createObject] Folder: ${dp_Folder}`);
		await this.setObjectNotExists(dp_Folder, {
			type: 'folder',
			common: {
				name: 'Measurements from station',
				desc: description + '> ' + location,
				role: 'info',
			},
			native: {},
		});
		this.log.debug(`[createObject] Station "${station}" City "${description}"`);
	}
	//
	//__________________________
	// removes illegal characters
	removeInvalidCharacters(inputString: string): string {
		const regexPattern = '[^a-zA-Z0-9]+';
		const regex = new RegExp(regexPattern, 'gu');
		return inputString.replace(regex, '_');
	}
	//__________________________
	// calculates the distance between two coordinates using the Haversine formula
	getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371; // Radius of the earth in kilometres
		const dLat = this.deg2rad(lat2 - lat1);
		const dLon = this.deg2rad(lon2 - lon1);
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const d = R * c; // Entfernung in km
		return d;
	}
	//__________________________
	// Convert to radians
	deg2rad(deg: number): number {
		return deg * (Math.PI / 180);
	}
	//

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
		} catch (e) {
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
