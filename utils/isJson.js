module.exports = function isJson(str) {
  let value = null;
  try {
    value = JSON.parse(str);
  } catch (e) {
    return false;
  }
  if (!isNaN(value)) {
    return false;
  }
  return true;
};
