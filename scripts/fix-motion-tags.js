const fs = require("fs");
const path = require("path");

const OPEN_BAD = "<" + "motion.div";
const OPEN_GOOD = "<div";
const CLOSE_BAD = "</" + "motion.div>";
const CLOSE_GOOD = "</div>";

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".jsx")) {
      const c = fs.readFileSync(p, "utf8");
      const n = c.split(CLOSE_BAD).join(CLOSE_GOOD).split(OPEN_BAD).join(OPEN_GOOD);
      if (n !== c) {
        fs.writeFileSync(p, n);
        console.log("fixed", p);
      }
    }
  }
}

walk(path.join(__dirname, "..", "renderer", "src"));
