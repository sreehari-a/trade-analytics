const getCurrentFinanicalYearStart = () => {
  const today = new Date();
  const year =
    today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return new Date(year, 3, 1); // April is month 3 (0-based index)
};

const convertToDateString = (dateObj) => {
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const month = dateObj.toLocaleString("en-US", { month: "short" }); // 'May', 'Jun', etc.
  const yyyy = dateObj.getFullYear();

  return `${dd}-${month}-${yyyy}`;
};

module.exports = {
  getCurrentFinanicalYearStart,
  convertToDateString,
};
