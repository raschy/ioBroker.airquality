interface Stations {
	[key: string]: {
		city: string;
		code: string;
		id: string;
		lat: string;
		lon: string;
		number: string;
		street: string;
		zipcode: string;
	};
}
interface Components {
	[key: string]: {
		name: string;
		unit: string;
		desc: string;
	};
}
//
interface Home {
	lat: number;
	lon: number;
}
