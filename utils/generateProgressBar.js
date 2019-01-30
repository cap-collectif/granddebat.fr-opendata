const MultiProgress = require("multi-progress");

const multi = new MultiProgress(process.stderr);

module.exports = (key, totalCount, offset = 0) => {
  return multi.newBar(
    `[:bar] :current / :total :percent :etas complete ${key}`,
    {
      total: offset ? totalCount - offset : totalCount,
      width: 20
    }
  );
};
