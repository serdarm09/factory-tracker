const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'MAMULLER.xlsx');
console.log('Reading file:', filePath);

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Get headers (first row)
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const headers = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: C })];
        headers.push(cell ? cell.v : undefined);
    }

    console.log('Headers:', headers);

    // Get first 3 rows of data
    const data = XLSX.utils.sheet_to_json(sheet, { header: headers, range: 1, limit: 3 });
    console.log('Sample Data:', data);

} catch (error) {
    console.error('Error reading Excel:', error);
}
