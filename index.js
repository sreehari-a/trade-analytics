require("dotenv").config();
const { getAccountsData } = require("./mailUtils");
const { getLastRowInSheet, updateValuesInSheet } = require("./sheetUtils");
const {
  getCurrentFinanicalYearStart,
  convertToDateString,
} = require("./utils");

require("dotenv").config();

async function fetchData(lastUpdatedDate) {
  const startDate = lastUpdatedDate;
  startDate.setDate(startDate.getDate() + 1);
}

(async function () {
  const { lastRowIndex, lastRow } = await getLastRowInSheet();
  let [serialNo, _, date] = lastRow;
  serialNo = isNaN(Number(serialNo)) ? 0 : Number(serialNo) ;
  const dateObj = new Date(date)
  const startDateObj =
    ( !isNaN(dateObj) && dateObj) || getCurrentFinanicalYearStart();
    !isNaN(dateObj) && startDateObj.setDate(startDateObj.getDate() + 1);

  const startDate = convertToDateString(startDateObj);

  console.log('lastRowIndex', lastRowIndex)

  const data = await getAccountsData(startDate, new Date().getTime());
  console.log("complete data", data);
  const insertData = [];
  const formulaRows = [];
  data.forEach((item) => {
    serialNo += 1;
    let currentRow = serialNo + 1;
    const prevRow = currentRow - 1;
    const isFirstRow = !(currentRow > 2);
    console.log("currentRow", currentRow);
    const { date, final_net, payin_payout_obligation } = item;
    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const currentDayOfWeek = daysOfWeek[new Date(date).getDay()];
    insertData.push([
      serialNo,
      currentDayOfWeek,
      date,
      payin_payout_obligation,
      (payin_payout_obligation - final_net).toFixed(2),
      final_net,
    ]);
    formulaRows.push([
      isFirstRow ? final_net : `=G${prevRow}+F${currentRow}`,
      isFirstRow ? 0 : `=G${currentRow}-MAX($G$1:G${currentRow})`,
    ]);
  });
  console.log("data", insertData);
  await updateValuesInSheet(lastRowIndex + 2, insertData, formulaRows);
  return true;
})();
