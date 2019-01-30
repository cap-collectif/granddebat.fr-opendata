const Json2csvTransform = require("json2csv").Transform;
const { Readable } = require("stream");
const JSONStream = require("JSONStream");
const fs = require("fs");

module.exports = key => {
  const jsonTransform = JSONStream.stringify();
  const jsonOutput = fs.createWriteStream(`${key}.json`);
  jsonTransform.pipe(jsonOutput);
  const transform = new Json2csvTransform({}, { objectMode: true });
  const csvInput = new Readable({ objectMode: true });
  const csvOutput = fs.createWriteStream(`${key}.csv`, {
    encoding: "utf8"
  });
  csvInput._read = () => {};
  csvInput.pipe(transform).pipe(csvOutput);
  return {
    csvSteam: csvInput,
    jsonStream: jsonTransform
  };
};
