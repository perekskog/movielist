import { App } from "./client/App.js";
import { createRoot } from "react-dom/client";
import "./index.css";

// Get uri parameters
const urlParams = new URLSearchParams(window.location.search);
const latest = urlParams.get("latest") || "false";

createRoot(document.getElementById("app")).render(<App latest={latest} />);
