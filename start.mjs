process.env.EZVIZ_API_BASE ??= "https://isgpopen.ezvizlife.com/api/lapp";
const eventPort = process.env.EVENT_API_PORT || "8788";
process.env.EVENT_API_URL ??= `http://127.0.0.1:${eventPort}`;
await import("./event-api/index.mjs");
await import("./index.mjs");
