"use strict";

const fs = require("fs");

const rmOptions = { recursive: true, force: true };

function rimraf(path, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }

  if (typeof callback === "function") {
    fs.rm(path, rmOptions, callback);
    return;
  }

  return fs.promises.rm(path, rmOptions);
}

rimraf.sync = function rimrafSync(path) {
  fs.rmSync(path, rmOptions);
};

module.exports = rimraf;
