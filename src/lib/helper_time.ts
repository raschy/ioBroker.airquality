//__________________________
// Get actual date as UTC-Date
export function getDateUTC(): Date {
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
//
//__________________________
// Build new Data with given hour
export function buildDate(h: number): Date {
	const d = new Date();
	console.log(d);
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, d.getMinutes(), d.getSeconds());
}
//__________________________
// Format totalMinutes to 'xh ym'
export const toHoursAndMinutes = (totalMinutes: number): string => {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours}h ${('00' + minutes).slice(-2)}m`;
};
//
//__________________________
// Format date (for US)

export function formatDate(d: Date): string {
	const year = d.getFullYear();
	const month = (d.getMonth() + 1).toString().padStart(2, '0');
	const day = d.getDate().toString().padStart(2, '0');
	return `${year}-${month}-${day}`;
}
//__________________________
// Format date for logfiles
export function logDate4File(): string {
	const d = new Date();
	const year = d.getFullYear();
	const month = (d.getMonth() + 1).toString().padStart(2, '0');
	const day = d.getDate().toString().padStart(2, '0');
	return `${year}${month}${day}`;
}
//
//
//__________________________
// Format date/time for logging
export function logDate(): string {
	const now = new Date();
	return now.toLocaleString('fr-CH'); // best format for log-entrys
}
//
//__________________________
// Hour formatted (with leading 0)
export function formatHour(d: Date): string {
	const hour = d.getHours().toString().padStart(2, '0');
	console.log(`(f) formatHour ${hour}`);
	return hour;
}
//
//__________________________
// converts string to Date
export function convertStringToDate(stringFromApi: string): Date {
	//console.log(`[convertStringToDate] ${stringFromApi}`);
	const newDate: Date = new Date(stringFromApi);
	return newDate;
}
//
//__________________________
// corrects the hours of a date by a +/- offset
export function correctHours(d: Date, offset: number): Date {
	d.setHours(d.getHours() - offset);
	return d;
}
//
//__________________________
// substract two hours from actual time
export function subtractTwoHours(): Date {
	const currentDate = new Date();
	currentDate.setHours(currentDate.getHours() - 2);
	return currentDate;
}
//
//__________________________
// extract hours from datestring
export function extraktHour(s: string): string {
	//var dateString = "2024-05-05 10:00:00";
	const timeString = s.split(' ')[1];
	const hour = timeString.split(':')[0];
	return hour;
}
//
//__________________________
// correct datestring from datestring by adding 1 hour
export function correctHour(s: string, offset: number): string {
	//var dateString = "2024-05-05 10:00:00";
	const dateString = s.split(' ')[0].split('-');
	const sDate = dateString[2] + '.' + dateString[1] + '.' + dateString[0];
	//
	const timeString = s.split(' ')[1].split(':');
	const hour = parseInt(timeString[0]) + offset; //Korrektur
	const sHour = hour.toString().padStart(2, '0');
	const sTime = sHour + ':' + timeString[1] + ' Uhr';
	return `${sDate} ${sTime}`;
}
