const fs = require("fs");
const path = require("path");
const { parseSourceToFunctions } = require("./parserCore");

const filePath = process.argv[2];
const code = fs.readFileSync(filePath, "utf-8");
const ext = path.extname(filePath).toLowerCase();

console.log(JSON.stringify(parseSourceToFunctions(code, ext)));
