import pretty from "pino-pretty";
import { default as PinoLogger } from "pino";
const stream = pretty({
  colorize: true,
  append: true,
  crlf: true,
  levelFirst: true,
  colorizeObjects: true,
  singleLine: true,
});

export const serviceName = `Middleware`;
export const SystemLogger = PinoLogger(
  {
    name: serviceName,
    enabled: true,
    safe: true,
  },
  stream,
);
