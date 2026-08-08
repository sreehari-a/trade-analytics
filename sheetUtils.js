const { google } = require("googleapis");
const { JWT } = require("google-auth-library");
const { getCredentials } = require("./authUtils");
async function getLastRowInSheet() {
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64").toString("utf8")
  );

  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID; // Replace with your actual ID
  const sheetName = process.env.SHEET_NAME
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values || [];


  // Start from the bottom and find the last non-empty row
  let lastRowIndex = rows.length - 1;
  while (lastRowIndex >= 2 && rows[lastRowIndex].every((cell) => cell === "")) {
    console.log('in loop')
    lastRowIndex--;
  }



  const lastRow = rows[lastRowIndex] || [];

  return {lastRowIndex,lastRow};
}

async function updateValuesInSheet(startRow, values, formulaRows) {
  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS, "base64").toString("utf8")
  );

  const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const numRows = values.length;
  const endRow = startRow + numRows - 1;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID; // Replace with your actual ID
  const sheetName = process.env.SHEET_NAME
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${startRow}:F${endRow}`,
    valueInputOption: "RAW",
    resource: { values },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!G${startRow}:H${endRow}`,
    valueInputOption: "USER_ENTERED",
    resource: { values: formulaRows },
  });
}

module.exports = {
  getLastRowInSheet,
  updateValuesInSheet,
};
