import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { PORT } from "./constants.js";
import { setupMiddleware } from "./middleware.js";
import { registerDiscoveryRoutes } from "./routes/discovery.js";
import { registerGraphRoutes } from "./routes/graph.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerOAuth2Routes } from "./routes/oauth2.js";
import { registerUserRoutes } from "./routes/users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

setupMiddleware(app, __dirname);
registerHealthRoutes(app);
registerUserRoutes(app);
registerOAuth2Routes(app);
registerGraphRoutes(app);
registerDiscoveryRoutes(app);

app.listen(PORT, () => {
  console.log(`Mock M365 Auth server running on port ${PORT}`);
});
