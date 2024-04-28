import { SystemLogger } from "@root/utils";

export const setupSignals = (shutdown) => {
  const signals = ["SIGTERM", "SIGINT", "SIGHUP", "SIGBREAK"];
  signals.forEach((signal) => {
    process.on(signal, () => {
      SystemLogger.warn(`Received ${signal}, shutting down...`);
      shutdown();
    });
  });
};
