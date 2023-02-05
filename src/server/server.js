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

server.get("/message", (req, res) => {
  console.log("/message");
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      messageOfTheDay: "TBD...",
    })
  );
});

server.post("/detectIntent", (req, res) => {
  console.log(JSON.stringify(req.body));
  const messageText = req.body.text;
  console.log(`/detectIntent ${messageText}`);
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      fullfilment: `TBD: Dialogflow fullfilment of "${messageText}"`,
    })
  );
});

server.listen(8080, () =>
  console.log("react-demo-chat listening on port 8080@230127 13:16")
);
