const path = require("path");
require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || "development-secret-change-me",
  databaseUrl: process.env.DATABASE_URL || "",
  publicDir: path.join(process.cwd(), "public"),
  migrationFile: path.join(process.cwd(), "migrations", "001_init.sql")
};
