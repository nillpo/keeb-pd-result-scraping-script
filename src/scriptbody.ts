import { createApp } from "./app.ts";

createApp({
  document,
  createObserver: (callback) => new MutationObserver(callback),
}).start();
