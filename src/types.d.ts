type Home = {
	lat: number;
	lon: number;
};

type Station = {
	id: string;
	code: string;
	city: string;
	lon: string;
	lat: string;
	network: string;
	street: string;
	number: string;
	zipcode: string;
};

type Stations = {
	[key: string]: Station;
};

type StationApiEntry = [
	string, // id (index 0)
	string, // code (1)
	string, // locationName (index 2)
	string, // city (index 3)
	string, // longitude (index 7)
	string, // latitude (index 8)
	string, // shortCode
	string, // startDate
	any, // endDate
	...any[], // rest
];

type ApiResponseStations = {
	count: number;
	data: {
		[key: string]: StationApiEntry;
	};
};

//	# Type Definitions for components #

type Component = {
	id: string;
	code: string;
	symbol: string;
	unit: string;
	desc: string;
};

type Components = {
	[key: string]: Component;
};

type ComponentApiEntry = [
	string, // id
	string, // code
	string, // symbol
	string, // unit
	string, // desc
];

type ApiResponseComponents = {
	data: {
		[key: string]: ComponentApiEntry;
	};
};

//	# Type Definitions for AirData #
type AirDataApiResponse<TData> = {
	request: object;
	indices: object;
	data: TData;
	count: number;
};

type AirQualityData = {
	[stationId: string]: {
		[measureStart: string]: AirQualityMeasurement;
	};
};

type AirQualityMeasurement = [
	measureEnd: string,
	overallAirQualityIndex: number,
	dataIncomplete: number,
	...detailsFromComponents: AirQualityFromComponent[],
];

type AirQualityFromComponent = [
	componentId: number,
	value: number,
	airQualityIndex: number,
	decimalAirQualityIndex: string,
];

type AirQualityResult = {
	success: boolean;
	stationId?: string;
	measurementTime?: string;
	measurementValues?: AirQualityFromComponent[];
};
