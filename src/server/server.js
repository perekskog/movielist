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
  console.log("/data.json");
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify([
      { title: "Item 1", tags: ["tag1", "tag2"] },
      { title: "Item 2", tags: ["tag2", "tag3"] },
    ])
  );
});

server.listen(8080, () =>
  console.log("react-demo-chat listening on port 8080@230127 13:16")
);
