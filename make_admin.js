const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

async function makeAdmin() {
  const sqlJs = await initSqlJs({
    locateFile: file => path.join(process.cwd(), "node_modules", "sql.js", "dist", file)
  });

  const sqliteFile = path.join(process.cwd(), '.data', 'team-task-manager.sqlite');
  const fileBuffer = fs.readFileSync(sqliteFile);
  const db = new sqlJs.Database(fileBuffer);

  db.run("UPDATE users SET role = 'ADMIN' WHERE email = 'hkadyan18@gmail.com'");

  fs.writeFileSync(sqliteFile, Buffer.from(db.export()));
  console.log("Updated hkadyan18@gmail.com to ADMIN!");
}

makeAdmin();
