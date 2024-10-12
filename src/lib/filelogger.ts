//  ======  File Logging   ======
// writeLog( fileHandle, "Text" );
// fileHandle = { path: './logs/airquality', file: 'logs.txt' };

import { promises as fs } from 'fs';
//
interface Logger {
	path: string;
	file: string;
}
//
export async function writeLog(fileObj: Logger, logEntry: string): Promise<void> {
	// Get the current date and time
	const now = new Date();
	const dateTime = now.toLocaleString('fr-CH'); // best format for log-entrys
	//
	if (!fileObj.path.endsWith('/')) {
		fileObj.path += '/';
		console.log(`"/" wurde an ${fileObj.path} angefügt.`);
	}
	//
	const dynFilename: string = createDynfilename(fileObj);
	console.log(`DynFilename: ${dynFilename}`);
	const newFilePath = [fileObj.path, dynFilename].join('');
	console.log(`newFilePath: ${newFilePath}`);
	// Format the log entry
	const data = `${dateTime}\t${logEntry}\n`;
	console.log(`Logentry: ${data}`);
	appendDataToFile(fileObj, data);
}

async function appendDataToFile(fileObj: Logger, data: string): Promise<void> {
	//console.log(`(f) checkDirectory ${JSON.stringify(fileObj)}`);
	if (!fileObj.path.endsWith('/')) {
		fileObj.path += '/';
		//console.log(`"/" wurde an ${fileObj.path} angefügt.`);
	}
	//
	try {
		// Überprüfen und Verzeichnis erstellen, falls es nicht existiert
		await fs.mkdir(fileObj.path, { recursive: true });
		// Daten an die Datei anhängen
		const filename = fileObj.path; //fileObj.file;
		//console.log(`Filename: ${filename}`);
		await fs.appendFile(filename, data);
		console.log(`Daten wurden erfolgreich an die Datei ${filename} angehängt.`);
	} catch (error: any) {
		if (error.code === 'EACCES') {
			console.log('Zugriffsfehler: Sie haben keine Berechtigung zum Anhängen von Daten an die Datei.');
		} else if (error.code === 'ENOENT') {
			console.log('Datei oder Verzeichnis nicht gefunden: ' + error.path);
		} else if (error.code === 'ENOTDIR') {
			console.log('Pfad ist kein Verzeichnis: ' + error.path);
		} else {
			console.log('Ein unbekannter Fehler ist aufgetreten:');
		}
	}
}
//__________________________
// Dynamic filename for logfiles
function createDynfilename(fileObj: Logger): string {
	const f: string[] = fileObj.file.split('.');
	const dynFile = [f[0], '_', logDate(), '.', f[1]].join('');
	return dynFile;
}
//
//__________________________
// Format date for logfiles yymmdd
function logDate(): string {
	const d = new Date();
	const year = d.getFullYear() - 2000;
	const month = (d.getMonth() + 1).toString().padStart(2, '0');
	const day = d.getDate().toString().padStart(2, '0');
	return `${year}${month}${day}`;
}
