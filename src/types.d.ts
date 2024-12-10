interface Home {
    lat: number;
    lon: number;
}

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
        network: string;
    };
}

interface Components {
    [key: string]: {
        name: string;
        unit: string;
        desc: string;
    };
}

interface ComponentData {
    id: number;
}
