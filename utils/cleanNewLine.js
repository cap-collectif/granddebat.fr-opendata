module.exports = function cleanNewLine(value) {
  if (value && typeof value === "string") {
    return value.replace(/(?:\r\n|\r|\n)/g, " ");
  }

  return value;
};
