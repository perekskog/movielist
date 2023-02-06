import express from "express";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

const __approot = path.dirname(fileURLToPath(import.meta.url + "/../.."));
console.log(__approot);

const server = express();
server.use(express.static(__approot + "/dist/"));
server.use(express.json());
server.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});
server.use(cors());

server.get("/data.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.sendFile(path.join(__approot + "/src/server/allmovies.json"));
});

server.listen(8080, () =>
  console.log("react-demo-chat listening on port 8080@230207 00:13")
);
