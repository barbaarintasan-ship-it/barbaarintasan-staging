import fs from "node:fs";
import { type Server } from "node:http";
import path from "node:path";

import express, { type Express, type Request } from "express";

import runApp from "./app";
import { getSheekoHtml } from "./sheekoTemplate";

export async function serveStatic(app: Express, server: Server) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to appropriate html file if the file doesn't exist (SPA routing)
  app.get("*", (req, res) => {
    // Use dynamically generated sheeko.html for /sheeko routes (separate PWA with its own manifest)
    if (req.path.startsWith('/sheeko')) {
      const sheekoHtml = getSheekoHtml(distPath);
      res.set({
        "Content-Type": "text/html",
        "Cache-Control": "no-cache"
      }).send(sheekoHtml);
    } else {
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });
}

(async () => {
  await runApp(serveStatic);
})();
