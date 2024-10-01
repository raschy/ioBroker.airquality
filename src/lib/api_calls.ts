'use strict';

import { writeLog } from './filelogger';
import { formatDate, getDateUTC } from './helper_time';
const fileHandle = { path: './logs/airquality', file: 'logs.txt' };
const baseUrl: string = 'https://umweltbundesamt.api.proxy.bund.dev/api/air_data/v3/';

// Read in all active measuring stations
export async function getStations(): Promise<Stations> {
	//url_Stations: 'https://umweltbundesamt.api.proxy.bund.dev/api/air_data/v3/stations/json?lang=de';
	const url: string = baseUrl + 'stations/json?lang=de';
	console.log(`[getStations] URL=${url}`);
	const _stations: Stations = {};
	return fetch(url, {
		method: 'GET',
		headers: {
			accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
		},
	}).then(async (response) => {
		if (!response.ok) throw new Error('[getStations] failed to retrieve data');
		const data: any = await response.json();
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
				lat: data.data[key][8],
			};
		}
		//console.log(_stations);
		return _stations;
	});
}

// Read in all components
export async function getComponents(): Promise<Components> {
	//url_Components: 'https://umweltbundesamt.api.proxy.bund.dev/api/air_data/v3/components/json?lang=de&index=id';
	const url: string = baseUrl + 'components/json?lang=de&index=id';
	console.log(`[getComponents] URL=${url}`);
	const _components: any = {};
	return fetch(url, {
		method: 'GET',
		headers: {
			accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
		},
	}).then(async (response) => {
		if (!response.ok) throw new Error('[getComponents] failed to retrieve data');
		const data: any = await response.json();
		for (const key in data) {
			if (!isNaN(parseInt(key))) {
				// Measurement types from the numerical lists
				_components[key] = { name: data[key][1], unit: data[key][3], desc: data[key][4] };
			}
		}
		//console.log(_components);
		return _components;
	});
}

// Read in all measurements
export async function getMeasurements(stationCode: string): Promise<any> {
	//url_Measurements: 'https://umweltbundesamt.api.proxy.bund.dev/api/air_data/v3/airquality/json?date_from=2024-09-11&time_from=14&date_to=2024-09-11&time_to=14&station=DENW430&lang=de'
	const urlSpec: string = 'airquality/json?';
	const urlStation: string = await prepareQueryParameters(stationCode);
	const url = [baseUrl, urlSpec, urlStation].join('');
	console.log(`[getMeasurements] URL=${url}`);
	let _measurements: any = {};
	return fetch(url, {
		method: 'GET',
		headers: {
			accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
		},
	}).then(async (response) => {
		if (!response.ok) throw new Error('[getMeasurements] failed to retrieve data');
		const data: any = await response.json();
		_measurements = data.data;
		return _measurements;
	});
}
//
/**
 * prepareQueryParameters
 * @param {string} stationCode
 * @returns {string} preparedQueryParameter
 */
async function prepareQueryParameters(stationCode: string): Promise<string> {
	const parameters = [];
	const workDate = getDateUTC();
	console.log(`WorkDate:(1) ${workDate}`);
	const _hour = workDate.getHours();
	const _hourFrom = _hour < 1 ? 24 : _hour;
	console.log(`hourFrom:(2) ${_hourFrom}`);
	//const _hourFrom1 = _hourFrom - 1;
	//const _hourTo = _hourFrom + 1;
	//
	const dateFrom = 'date_from=' + formatDate(workDate);
	//console.log(`dateFrom:(3) ${dateFrom}`);
	parameters.push(dateFrom);
	//
	const timeFrom = 'time_from=' + String(_hourFrom);
	//console.log(`timeFrom:(4) ${timeFrom}`);
	parameters.push(timeFrom);
	//
	const dateTo = 'date_to=' + formatDate(workDate);
	//console.log(`dateTo:(6) ${dateTo}`);
	parameters.push(dateTo);
	//
	const timeTo = 'time_to=' + String(_hourFrom); //_hourTo
	//console.log(`timeTo:(7) ${timeTo}`);
	parameters.push(timeTo);
	//
	parameters.push('station=' + stationCode);
	//console.log(`station:(8) ${stationCode}`);
	parameters.push('lang=de');
	//
	const preparedQueryParameter = parameters.join('&');
	console.log(`Parameter: ${preparedQueryParameter}`);
	writeLog(fileHandle, preparedQueryParameter);
	return preparedQueryParameter;
}
