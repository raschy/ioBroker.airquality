'use strict';
/*
 * Created with @iobroker/create-adapter v2.6.5
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
// Load your modules here, e.g.:
import * as utils from '@iobroker/adapter-core';
import { getComponents, getMeasurements, getMeasurementsComp, getStations } from './lib/api_calls';

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
	stationList: Stations = {};
	components: Components = {};
	private numberOfElements: number = 0;
	private retryCount: number = 0;
	private readonly retryDelay: number = 2;
	private readonly maxRetries: number = 3;
	private timeoutId: any;
	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		//
		await this.delay(Math.floor(Math.random() * 10000)); // delay start for 0-10 seconds
		//
		try {
			this.stationList = await getStations();
		} catch (err: unknown) {
			this.log.error(`[onReady] Error when calling getStations: ${JSON.stringify(err)}`);
		}
		//
		try {
			this.components = await getComponents();
		} catch (err: unknown) {
			this.log.error(`[onReady] Error when calling getComponents: ${JSON.stringify(err)}`);
		}
		//
		if (this.config.stations.length == 0) {
			this.log.info('[onReady] No stations specified');
			// if no station is selected in config
			const home: Home = this.getLocation();
			if (home.lat > 0) {
				const nearestStationIdx: number = this.findNearestStation(home, this.stationList);
				this.log.info(`[onReady] nearest Station Index: ${nearestStationIdx}`);
				await this.writeStationToConfig(this.stationList[nearestStationIdx].code);
			}
		}
		//
		await this.controller();
		//End onReady
	}

	/**
	 * controller
	 */
	private async controller(): Promise<void> {
		try {
			const data = await this.worker();
			if (data) {
				this.log.info('[controller] Data retrieved successfully.');
				// Verarbeitung der Daten hier...
				await this.setState('info.lastUpdate', { val: Date.now(), ack: true });
				this.stopAdapter();
			} else {
				throw new Error('No data received.');
			}
		} catch (err) {
			this.retryCount++;
			this.log.warn(
				`[controller] Retrieval failed (attempt ${this.retryCount}/${this.maxRetries}): ${String(err)}`,
			);
			if (this.retryCount < this.maxRetries) {
				this.log.info(`[controller] New attempt in ${this.retryDelay} minutes...`);
				this.timeoutId = setTimeout(() => this.controller(), this.retryDelay * 60000);
			} else {
				this.log.silly('[controller] Maximum number of attempts reached. Adapter will terminated.');
				this.stopAdapter();
			}
		}
	}

	/**
	 * worker function to call data from the selected stations
	 */
	async worker(): Promise<boolean> {
		const selectedStations = this.config.stations;
		this.log.info(`[worker] Attempting to call data from the selected stations: ${selectedStations}`);
		//
		let success = false;
		try {
			for (const station of selectedStations) {
				await this.delay(Math.floor(Math.random() * 1000));
				this.log.debug(`[worker] fetches data from ${station}`);
				//this.actualStation = station;
				this.numberOfElements = 0;
				// all available components
				const measurement = await getMeasurements(station);
				if (measurement.success) {
					await this.parseData(measurement);
					success = measurement.success;
				}
				// only specified component
				const measurementComp = await getMeasurementsComp(station, 2); // 2 = CO
				if (measurementComp.success) {
					await this.parseData(measurementComp);
				}
			}
			//
			return success;
		} catch (error: unknown) {
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
	async persistData(
		station: string,
		sensor: string,
		name: string,
		value: number | string,
		unit: string,
		role: string,
	): Promise<void> {
		const dp_Sensor = `${this.removeInvalidCharacters(station)}.${this.removeInvalidCharacters(sensor)}`;
		this.log.silly(
			`[persistData] Station "${station}"  Sensor "${sensor}"  Desc "${name}" with value: "${value}" and unit "${unit}" as role "${role}"`,
		);
		//
		if (isNumber(value)) {
			//value = parseFloat(value);
			await this.setObjectNotExistsAsync(dp_Sensor, {
				type: 'state',
				common: {
					name: name,
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
					name: name,
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
		await this.setState(dp_Sensor, { val: value, ack: true, q: 0x00 });
		//
		function isNumber(n: any): boolean {
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
	async storeData(station: string, valueNMT: number | string, valueTLM: number | string): Promise<void> {
		const dp_Station = this.removeInvalidCharacters(station);
		// Store Number of measurement types
		const dp_SensorNMT = `${dp_Station}._NMT`;
		this.log.silly(`[storeData] Station "${station}", Sensor "_NMT" with value: "${valueNMT}"`);
		//
		await this.setObjectNotExistsAsync(dp_SensorNMT, {
			type: 'state',
			common: {
				name: {
					en: 'Number of measurement types',
					de: 'Anzahl der Messarten',
					ru: 'Число типов измерений',
					pt: 'Número de tipos de medição',
					nl: 'Aantal meettypes',
					fr: 'Nombre de types de mesure',
					it: 'Numero di tipi di misura',
					es: 'Número de tipos de medición',
					pl: 'Liczba typów pomiarów',
					uk: 'Кількість типів вимірювання',
					'zh-cn': '计量类型数目',
				},
				type: 'number',
				role: 'value',
				unit: '',
				read: true,
				write: false,
			},
			native: {},
		});
		//
		await this.setState(dp_SensorNMT, { val: valueNMT, ack: true, q: 0x00 });
		//
		// Store Time of the last measurement
		const dp_SensorTLM = `${dp_Station}._TLM`;
		this.log.silly(`[storeData] Station "${station}", Sensor "_TLM" with value: "${valueTLM}"`);
		//
		await this.setObjectNotExistsAsync(dp_SensorTLM, {
			type: 'state',
			common: {
				name: {
					en: 'Time of the last measurement',
					de: 'Zeit der letzten Messung',
					ru: 'Время последнего измерения',
					pt: 'Tempo da última medição',
					nl: 'Tijd van de laatste meting',
					fr: 'Durée de la dernière mesure',
					it: "Tempo dell' ultima misura",
					es: 'Tiempo de la última medición',
					pl: 'Czas ostatniego pomiaru',
					uk: 'Час останнього вимірювання',
					'zh-cn': '上次测量的时间',
				},
				type: 'string',
				role: 'text',
				unit: '',
				read: true,
				write: false,
			},
			native: {},
		});
		//
		await this.setState(dp_SensorTLM, { val: valueTLM, ack: true, q: 0x00 });
	}

	/**
	 * Retrieves the desired data from the payload and prepares data for storage
	 *
	 * @param {} payload Object from Response
	 //* @returns Data to persist
	 */
	async parseData(payload: any): Promise<void> {
		this.log.debug(`[parseData] Payload: ${JSON.stringify(payload)}`);
		/*
		Payload: {"stationId":"145","measurementTime":"2025-06-03 14:00:00","measurementValues":[
		[3,105,1,"1.746"],[5,5,0,"0.25"],[1,17,0,"0.85"],[9,10,0,"1"]
		]}
  		*/
		if (Object.keys(payload).length === 0) {
			this.log.debug('[parseData] No data received');
			return;
		}
		const localDate = new Date();
		const summerOffset = localDate.getTimezoneOffset() / 60;
		//
		const stationId: number = payload.stationId;
		const timeEndAdjusted: string = this.correctHour(payload.measurementTime, summerOffset * -1 - 1);
		//
		await this.createObject(
			this.stationList[stationId].code,
			this.stationList[stationId].city,
			this.stationList[stationId].street,
		);
		//
		for (const item of Object.keys(payload.measurementValues)) {
			const measurement = payload.measurementValues[item];
			await this.persistData(
				this.stationList[stationId].code,
				this.components[measurement[0]].code,
				this.components[measurement[0]].desc,
				measurement[1], // Value
				this.components[measurement[0]].unit,
				'value',
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
	 * Create a folder for station
	 *
	 * @param station Station Code
	 * @param description Station City
	 * @param location Station Street
	 */
	async createObject(station: string, description: string, location: string): Promise<void> {
		const dp_Folder = this.removeInvalidCharacters(station);
		if (await this.objectExists(dp_Folder)) {
			return;
		}
		//
		await this.setObjectNotExists(dp_Folder, {
			type: 'folder',
			common: {
				name: {
					en: 'Measurements from station',
					de: 'Messungen von Station',
					ru: 'Ð˜Ð·Ð¼ÐµÑ€ÐµÐ½Ð¸Ñ Ð½Ð° ÑÑ‚Ð°Ð½Ñ†Ð¸Ð¸',
					pt: 'MediÃ§Ãµes da estaÃ§Ã£o',
					nl: 'Metingen vanaf het station',
					fr: 'Mesures de la station',
					it: 'Misure dalla stazione',
					es: 'Medidas desde la estaciÃ³n',
					pl: 'Pomiary ze stacji',
					uk: 'Ð’Ð¸Ð¼Ñ–Ñ€ÑŽÐ²Ð°Ð½Ð½Ñ Ð· ÑÑ‚Ð°Ð½Ñ†Ñ–Ñ—',
					'zh-cn': 'ä»Žè½¦ç«™æµ‹é‡',
				},
				desc: `${description}> ${location}`,
				role: 'info',
			},
			native: {},
		});
		this.log.debug(`[createObject] Station "${station}" City "${description}"`);
	}

	/**
	 * Use the specified coordinates from the configuration
	 *
	 * @returns Koordinates(lat, lon)
	 */
	getLocation(): Home {
		if (this.latitude == undefined || this.latitude == 0 || this.longitude == undefined || this.longitude == 0) {
			this.log.warn(
				'longitude/latitude not set in system-config - please check instance configuration of "System settings"',
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
	findNearestStation(localHome: Home, coordinates: Stations): number {
		let minDistance: number = Number.MAX_VALUE;
		let nearestStation = 0;
		this.log.debug(`[findNearestStation]: Latitude: ${localHome.lat} Longitude: ${localHome.lon}`);
		//
		for (const key of Object.keys(coordinates)) {
			const distance = this.getDistanceFromLatLonInKm(
				localHome.lat,
				localHome.lon,
				parseFloat(coordinates[key].lat),
				parseFloat(coordinates[key].lon),
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
	async writeStationToConfig(localStation: string): Promise<void> {
		const _station: Array<string> = [];
		await this.getForeignObject(`system.adapter.${this.namespace}`, (err, obj) => {
			if (err) {
				this.log.error(`[writeStationToConfig] ${err}`);
			} else {
				if (obj) {
					_station.push(localStation); // must be an array
					obj.native.stations = _station; // modify object
					this.setForeignObject(obj._id, obj, err => {
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

	/**
	 * calculates the distance between two coordinates using the Haversine formula
	 *
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
	 *
	 * @param inputString Designated name for an object/data point
	 * @returns Cleaned name for an object/data point
	 */
	removeInvalidCharacters(inputString: string): string {
		const regexPattern = '[^a-zA-Z0-9]+';
		const regex = new RegExp(regexPattern, 'gu');
		return inputString.replace(regex, '_');
	}

	/**
	 * correct datestring from datestring by adding x hours (offset)
	 *
	 * @param s Datestring
	 * @param offset Offset
	 * @returns String with Date & Time
	 */
	correctHour(s: string, offset: number): string {
		const dateString = s.split(' ')[0].split('-');
		const sDate = `${dateString[2]}.${dateString[1]}.${dateString[0]}`;
		//
		const timeString = s.split(' ')[1].split(':');
		const hour = parseInt(timeString[0]) + offset; //Korrektur
		const sHour = hour.toString().padStart(2, '0');
		const sTime = `${sHour}:${timeString[1]}`;
		return `${sDate} ${sTime}`;
	}
	/**
	 * my own methode to stop an adapter
	 */
	private stopAdapter(): void {
		this.terminate ? this.terminate('Everything done. Finished till next schedule', 11) : process.exit(0);
		/*
		if (typeof this.stop === 'function') {
			await this.stop();
		} else {
			this.log.warn(
				'this.stop ist nicht verfügbar – Adapter konnte möglicherweise nicht korrekt beendet werden.',
			);
		}
		*/
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 *
	 * @param callback Callback
	 */
	private onUnload(callback: () => void): void {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			//clear setTimeout
			if (this.timeoutId != undefined) {
				clearTimeout(this.timeoutId); // Cancels the timeout
				this.timeoutId = undefined;
			}
			callback();
		} catch (e) {
			this.log.debug(`[onUnload] ${JSON.stringify(e)}`);
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
