'use strict';

const baseUrl = 'https://umweltbundesamt.api.proxy.bund.dev/api/air_data/v3/';

/**
 *
 * @returns Stations with airquality
 */
export async function getStations(): Promise<Stations> {
    //url_Stations: 'https://umweltbundesamt.api.proxy.bund.dev/api/air_data/v3/stations/json?lang=de';
    //const url: string = baseUrl + 'stations/json?lang=de';
    const urlStation: string = prepareQueryParameters('');
    const url = [baseUrl, 'stations/json?use=airquality&lang', urlStation].join('');
    const _stations: Stations = {};
    return fetch(url, {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        },
    }).then(async response => {
        if (!response.ok) {
            throw new Error('[getStations] failed to retrieve data');
        }
        const data: any = await response.json();
        for (const key in data.data) {
            const stationId: number = data.data[key][0];
            //
            _stations[stationId] = {
                id: data.data[key][0],
                code: data.data[key][1],
                city: data.data[key][3],
                network: data.data[key][12],
                street: data.data[key][17],
                number: data.data[key][18],
                zipcode: data.data[key][19],
                lon: data.data[key][7],
                lat: data.data[key][8],
                //
            };
        }
        return _stations;
    });
}

/**
 *
 * @returns Components
 */
export async function getComponents(): Promise<Components> {
    //url_Components: 'https://umweltbundesamt.api.proxy.bund.dev/api/air_data/v3/components/json?lang=de&index=id';
    const url = `${baseUrl}components/json?lang=de&index=id`;
    const _components: Components = {};
    return fetch(url, {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        },
    }).then(async response => {
        if (!response.ok) {
            throw new Error('[getComponents] failed to retrieve data');
        }
        const data: any = await response.json();
        for (const key in data) {
            if (!isNaN(parseInt(key))) {
                // Measurement types from the numerical lists
                _components[key] = { name: data[key][1], unit: data[key][3], desc: data[key][4] };
            }
        }
        return _components;
    });
}

/**
 *
 * @param stationCode alphanumeric Code
 * @returns Measurements
 */
export async function getMeasurements(stationCode: string): Promise<any> {
    //url_Measurements: 'https://umweltbundesamt.api.proxy.bund.dev/api/air_data/v3/airquality/json?date_from=2024-09-11&time_from=14&date_to=2024-09-11&time_to=14&station=DENW430&lang=de'
    const urlSpec = 'airquality/json?';
    const urlStation: string = prepareQueryParameters(stationCode);
    const url = [baseUrl, urlSpec, urlStation].join('');
    let _measurements: any = {};
    return fetch(url, {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        },
    }).then(async response => {
        if (!response.ok) {
            throw new Error('[getMeasurements] failed to retrieve data');
        }
        const data: any = await response.json();
        _measurements = data.data;
        return _measurements;
    });
}

/**
 *
 * @param stationCode alphanumeric Code
 * @param component numeric Value
 * @returns Measurements
 */
export async function getMeasurementsComp(stationCode: string, component: number): Promise<any> {
    //https://www.umweltbundesamt.de/api/air_data/v3/measures/json?date_from=2024-11-29&date_to=2024-11-29&time_from=7&time_to=8&station=DEHE018&component=2
    const urlSpec = 'measures/json?';
    const urlStation: string = prepareQueryParameters(stationCode);
    const url = [baseUrl, urlSpec, urlStation, '&component=', component].join('');
    let _measurements: any = {};
    return fetch(url, {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        },
    }).then(async response => {
        if (!response.ok) {
            throw new Error('[getMeasurements] failed to retrieve data');
        }
        const data: any = await response.json();
        _measurements = data.data;
        return _measurements;
    });
}

/**
 *
 * @param stationCode alphanumeric Code
 * @returns preparedQuery
 */
function prepareQueryParameters(stationCode: string): string {
    const parameters = [];
    const workDate = getDateUTC();
    const _hour = workDate.getHours();
    const _hourFrom = _hour < 1 ? 24 : _hour;
    //const _hourFrom1 = _hourFrom - 1;
    //const _hourTo = _hourFrom + 1;
    //
    const dateFrom = `date_from=${formatDate(workDate)}`;
    parameters.push(dateFrom);
    //
    const timeFrom = `time_from=${String(_hourFrom)}`;
    parameters.push(timeFrom);
    //
    const dateTo = `date_to=${formatDate(workDate)}`;
    parameters.push(dateTo);
    //
    const timeTo = `time_to=${String(_hourFrom)}`; //_hourTo
    parameters.push(timeTo);
    //
    if (stationCode != '') {
        parameters.push(`station=${stationCode}`);
        parameters.push('lang=de');
    }
    //
    const preparedQueryParameter: string = parameters.join('&');
    //console.log(`Parameter: ${preparedQueryParameter}`);

    return preparedQueryParameter;
}

function getDateUTC(): Date {
    const d = new Date();
    return new Date(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds(),
    );
}

function formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}
