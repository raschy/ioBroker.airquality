'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStations = getStations;
exports.getComponents = getComponents;
exports.getMeasurements = getMeasurements;
exports.getMeasurementsComp = getMeasurementsComp;
//const baseUrl = 'https://umweltbundesamt.api.proxy.bund.dev/api/air_data/v3/';
const baseUrl = 'https://www.umweltbundesamt.de/api/air_data/v3/';
/**
 *
 * @returns Stations with airquality
 */
function getStations() {
    return __awaiter(this, void 0, void 0, function* () {
        // "https://www.umweltbundesamt.de/api/air_data/v3/stations/json?use=measure&lang=de&date_from=2025-06-24&date_to=2025-06-24&time_from=14&time_to=14"
        const stations = {};
        try {
            //const url = `${baseUrl}stations/json?lang=de`;
            const url = `${baseUrl}stations/json?use=measure&lang=de`; // Stations that also provide measured values
            const response = yield fetch(url, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                },
            });
            if (!response.ok) {
                throw new Error(`[getStations] HTTP-Fehler: ${response.status}`);
            }
            const raw = (yield response.json());
            //con_sole.log('[getStations] Count:', raw.count);
            //raw.count = 0; // Setze count auf 0, um leere Antwort zu simulieren
            // Überprüfe, ob die Antwortstruktur gültig ist
            if (!raw || typeof raw !== 'object' || !raw.data || typeof raw.data !== 'object' || raw.count < 1) {
                throw new Error('[getStations] Invalid or empty response structure from the server');
            }
            // Iteriere über die Stationseinträge
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
                    zipcode: entry[19],
                };
            }
            // Wenn keine gültigen Stationen gefunden wurden → Fehler!
            if (Object.keys(stations).length === 0) {
                throw new Error('No valid stations found');
            }
            return stations;
        }
        catch (error) {
            console.error('Error when calling up station data: ', error);
            throw error;
        }
        // only these fields of the stations are of interest
        function isValidStationEntry(entry) {
            if (!Array.isArray(entry) || entry.length < 20) {
                return false;
            }
            const expectedStrings = [0, 1, 3, 7, 8, 12, 17, 18, 19];
            return expectedStrings.every(index => typeof entry[index] === 'string');
        }
    });
}
/**
 *
 * @returns Components
 */
function getComponents() {
    return __awaiter(this, void 0, void 0, function* () {
        const url = `${baseUrl}components/json?lang=de`;
        try {
            const response = yield fetch(url, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error(`[getComponents] HTTP Error: ${response.status}`);
            }
            const raw = (yield response.json());
            if (!raw || typeof raw !== 'object') {
                throw new Error('[getComponents] Unexpected response format');
            }
            const components = {};
            for (const key of Object.keys(raw)) {
                // skip Metadata like "count" and "indices"
                if (key === 'count' || key === 'indices') {
                    continue;
                }
                const entry = raw[key];
                //con_sole.log('[getComponents] Entry ', entry);
                if (Array.isArray(entry) && entry.length >= 5) {
                    const [id, code, symbol, unit, desc] = entry;
                    components[id] = {
                        id,
                        code,
                        symbol,
                        unit,
                        desc,
                    };
                }
                else {
                    console.warn(`[getComponents] Invalid entry for key "${key}":`, entry);
                }
            }
            if (Object.keys(components).length === 0) {
                throw new Error('No valid components found');
            }
            return components;
        }
        catch (error) {
            console.error('Error when calling up the components:', error);
            throw error;
        }
    });
}
/**
 *
 * @param stationCode alphanumeric Code
 * @returns Measurements
 */
function getMeasurements(stationCode) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const urlSpec = 'airquality/json?';
            const urlStation = prepareQueryParameters(stationCode);
            const url = [baseUrl, urlSpec, urlStation].join('');
            //console.log('[getMeasurements] URL ', url);
            //
            const response = yield fetch(url, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                },
            });
            if (!response.ok) {
                throw new Error(`[getMeasurements] HTTP-Fehler: ${response.status}`);
            }
            //
            const measuresResponse = yield response.json();
            //
            if (!measuresResponse ||
                typeof measuresResponse !== 'object' ||
                !measuresResponse.data ||
                typeof measuresResponse.data !== 'object') {
                throw new Error('Invalid or empty response');
            }
            //
            //con_sole.log('[#getMeasurements] Request:', measuresResponse.request);
            //con_sole.log('[#getMeasurements] Indices:', measuresResponse.indices);
            //con_sole.log('[#getMeasurements] Count:', measuresResponse.count);
            //con_sole.log('[#getMeasurements##] data:', measuresResponse.data);
            //
            // Iteriere über die Messwerte
            for (const stationId of Object.keys(measuresResponse.data)) {
                const airQualityData = measuresResponse.data[stationId];
                //con_sole.log('[#getMeasurements] airQualityData: ', airQualityData);
                //con_sole.log(`[#getMeasurements] Verarbeite Station: ${stationId}`);
                if (typeof airQualityData !== 'object' || !airQualityData) {
                    continue;
                }
                // Wenn keine Daten empfangen wurden, leeres Objekt
                if (measuresResponse.count < 1) {
                    //console.log('[#getMeasurements] NoData, empty');
                    return { success: false };
                }
                //
                for (const datetime of Object.keys(airQualityData)) {
                    const entry = airQualityData[datetime];
                    //con_sole.log('[#getMeasurements] Entry ', JSON.stringify(entry));
                    //con_sole.log(`[#getMeasurements] Verarbeite Messwert für ${stationId} @ ${datetime}`);
                    if (!Array.isArray(entry) || entry.length < 4) {
                        console.warn(`[getMeasurements] Invalid entry for ${stationId} @ ${datetime}`);
                        continue;
                    }
                    const [endTime, , , ...componentArrays] = entry;
                    //con_sole.log('[#getMeasurements] EndTime ', endTime); //Date of measure end  in CET - string
                    //con_sole.log('[#getMeasurements] Array ', componentArrays);
                    const result = {
                        success: true,
                        stationId,
                        measurementTime: endTime,
                        measurementValues: componentArrays,
                    };
                    return result;
                }
            }
            return { success: false };
        }
        catch (error) {
            console.error('Error when calling up the measured values:', error);
            throw error;
        }
    });
}
/**
 *
 * @param stationCode alphanumeric Code
 * @param component number
 * @returns Measurements
 */
function getMeasurementsComp(stationCode, component) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const urlSpec = 'measures/json?';
            const urlStation = prepareQueryParameters(stationCode);
            const url = [baseUrl, urlSpec, urlStation, '&component=', component, '&scope=4'].join('');
            // scope=2 ==>  "Ein-Stunden-Mittelwert"; scope=4 ==> "Acht-Stunden-Mittelwert"
            //	CO (component=2) only works with scope 4!
            //
            const response = yield fetch(url, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                },
            });
            if (!response.ok) {
                throw new Error(`[getMeasurementsComp] HTTP-Fehler: ${response.status}`);
            }
            const measuresResponse = yield response.json();
            if (!measuresResponse ||
                typeof measuresResponse !== 'object' ||
                !measuresResponse.data ||
                typeof measuresResponse.data !== 'object') {
                throw new Error('Invalid or empty response');
            }
            // Iteriere über die Messwerte
            for (const stationId of Object.keys(measuresResponse.data)) {
                const airQualityData = measuresResponse.data[stationId];
                if (typeof airQualityData !== 'object' || !airQualityData) {
                    continue;
                }
                // Wenn keine Daten empfangen wurden, leeres Objekt
                for (const datetime of Object.keys(airQualityData)) {
                    const entry = airQualityData[datetime];
                    if (!Array.isArray(entry) || entry.length < 4) {
                        console.warn(`[#getMeasurementsComp] Invalid entry for ${stationId} @ ${datetime}`);
                        continue;
                    }
                    /*
                    [	"0: Id of component - integer",
                        "1: Id of scope - integer",
                        "2: Value - number",
                        "3: Date of measure end - string",
                        "4: Index - string|null"	]
                    */
                    const [componentId, scopeId, value, endTime, index] = entry;
                    const componentArray = [Number(componentId), value, scopeId, String(index)];
                    const result = {
                        success: true,
                        stationId,
                        measurementTime: String(endTime),
                        measurementValues: [componentArray],
                    };
                    return result;
                }
            }
            return { success: false };
        }
        catch (error) {
            console.error('Error when calling up the measured values: ', error);
            throw error;
        }
    });
}
/**
 *
 * @param stationCode alphanumeric Code
 * @returns preparedQuery
 */
function prepareQueryParameters(stationCode) {
    const parameters = [];
    const workDate = getDateUTC();
    const _hour = workDate.getHours();
    const _hourFrom = _hour < 1 ? 24 : _hour;
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
        //parameters.push('lang=de');
    }
    //
    const preparedQueryParameter = parameters.join('&');
    //con_sole.log(`Parameter: ${preparedQueryParameter}`);
    return preparedQueryParameter;
}
function getDateUTC() {
    const d = new Date();
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}
function formatDate(d) {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}
//# sourceMappingURL=api_calls.js.map