"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const templateDir = path.join(root, "build");
const templateDb = path.join(templateDir, "pos-template.db");
const stagingDb = path.join(templateDir, "staging.db");

fs.mkdirSync(templateDir, { recursive: true });
if (fs.existsSync(stagingDb)) fs.unlinkSync(stagingDb);

const dbUrl = `file:${stagingDb.replace(/\\/g, "/")}`;
execSync("npx prisma db push --skip-generate", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: dbUrl }
});

fs.copyFileSync(stagingDb, templateDb);
fs.unlinkSync(stagingDb);
console.log("Created", templateDb);
