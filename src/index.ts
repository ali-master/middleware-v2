import { Elysia } from "elysia";
// Routes
import { ProxyService } from "@root/routes";
// Utilities
import ip from "ip";
import { hostname } from "os";
import { cors } from "@elysiajs/cors";
import { serverTiming } from "@elysiajs/server-timing";
import { version as appVersion } from "../package.json";
import { KucoinWsClient } from "@root/utils/socket/socket";
import {
  CommonConfig,
  SystemLogger,
  serviceName,
  setupSignals,
  incrementRequestCounter,
  monitoring,
  incrementResponseDuration,
} from "@root/utils";
// Exceptions

import { TimeoutException } from "@root/exceptions";
// Enums
import { IoTokenRoom } from "@root/enums/token.enum";
// Types
import type { Method } from "@effect/platform/src/Http/Method";

async function bootstrap() {
  SystemLogger.flush();

  const kucoin = new KucoinWsClient({
    isPrivate: false,
    baseURL: CommonConfig.KUCOIN_OPENAPI_BASE_URL,
    authVersion: CommonConfig.KUCOIN_OPENAPI_VERSION,
  });
  kucoin.onEvent("retry-subscription", () => {
    SystemLogger.warn("Retrying subscription...");
  });
  kucoin.onEvent("error", (error) => {
    SystemLogger.error(error, "Socket error occurred");
  });
  kucoin.onEvent("close", () => {
    SystemLogger.warn("Connection closed");
  });
  kucoin.onEvent("ping", () => {
    SystemLogger.warn("Received ping message");
  });
  kucoin.onEvent("welcome", () => {
    SystemLogger.info("Received welcome message");
  });
  kucoin.onEvent("reconnect", () => {
    SystemLogger.warn("Reconnecting socket");
  });
  kucoin.onEvent("subscription", (data) => {
    SystemLogger.info(data, "Subscribed to the Market Ticker");
  });
  kucoin.onEvent("unsubscription", (data) => {
    SystemLogger.info(data, "Unsubscribed from the Market Ticker subscription");
  });

  const logger = SystemLogger.child({ context: "bootstrap" });
  const app = new Elysia({
    name: serviceName,
    forceErrorEncapsulation: true,
    prefix: "/api",
    websocket: {
      sendPings: true,
      idleTimeout: 960,
      perMessageDeflate: true,
    },
  })
    .trace(async ({ handle }) => {
      const { children } = await handle;
      if (!children.length) {
        const { time: start, end, name } = await handle;
        const duration = Math.abs((await end) - start);

        SystemLogger.info(`Request ${name ?? "unknown"} took ${duration}ms`);
        incrementResponseDuration({
          duration,
          handler: name ?? "unknown",
        });
      } else {
        for (const child of children) {
          const { time: start, end, name } = await child;
          const duration = Math.abs((await end) - start);

          SystemLogger.info(`Request ${name ?? "unknown"} took ${duration}ms`);
          incrementResponseDuration({
            duration,
            handler: name ?? "unknown",
          });
        }
      }
    })
    .onError(({ error, request }) => {
      SystemLogger.error(
        `Error occurred while processing request: ${request.url} with error: ${error}`,
      );
      const isTimeout = error.stack.startsWith(TimeoutException.name);
      if (isTimeout) {
        return {
          status: 408,
          message: "Request Timeout",
        };
      }

      return {
        status: 500,
        message: "Internal Server Error",
      };
    })
    .onResponse(async ({ path, body, request }) => {
      if (path.includes("proxy")) {
        const { reqUrl, method } = body as Record<string, string>;
        incrementRequestCounter({
          method,
          route: reqUrl,
        });
      } else {
        incrementRequestCounter({
          method: request.method,
          route: request.url,
        });
      }
    })
    .decorate({
      ProxyService: new ProxyService(),
    })
    .group("/v1", (app) => {
      return app
        .get("health-check", function systemHealthCheck() {
          return {
            status: "up",
            version: appVersion,
          };
        })
        .get("/health-check/ws", function wsHealthCheck({ error }) {
          if (kucoin.isSocketOpen) {
            return {
              status: "up",
            };
          }

          return error(500, {
            status: "down",
          });
        })
        .get("metrics", function metrics({ set }) {
          set.headers["Content-Type"] = monitoring.contentType;

          return monitoring.metrics();
        });
    })
    .all("/proxy", function proxy({ ProxyService, body: reqBody }) {
      const { reqUrl, method, body, headers } = reqBody as Record<string, string>;
      return ProxyService.proxy({
        body,
        headers,
        reqUrl,
        method: method as Method,
      });
    })
    .get("/market-pair/:pair", function getMarketPair({ ProxyService, params }) {
      const { pair } = params;

      return ProxyService.getMarketPair(pair);
    })
    .ws("/socket", {
      open: (ws) => {
        logger.info(`Client connected with ID: ${ws.id} and IP: ${ws.remoteAddress}`);
      },
      message(ws, message) {
        ws.subscribe((message as { channel: string })?.channel);
      },
      close: ({ id, unsubscribe }) => {
        logger.info(`Client disconnected with id: ${id}`);
        unsubscribe(IoTokenRoom.PRICES);
      },
    });
  app.use(cors());
  app.use(
    serverTiming({
      report: true,
      enabled: true,
    }),
  );
  logger.info(`${serviceName} Service is starting...`);
  app.listen(
    {
      development: CommonConfig.IS_DEVELOPMENT,
      hostname: "0.0.0.0",
      port: CommonConfig.PORT,
      reusePort: false,
    },
    async (server) => {
      const appUrl = `http://${server.hostname}:${server.port}`;
      logger.info(`${serviceName} Service started`);
      logger.info(`Address: ${appUrl}`);
      logger.info(`Host IP: ${ip.address()}`);
      logger.info(`App Version: ${appVersion}`);
      logger.info(`Hostname: ${hostname()}`);
      logger.info(`Process ID: ${process.pid}`);
      logger.info(`Node Environment Mode: ${CommonConfig.ENV}`);

      kucoin.onEvent("open", () => {
        SystemLogger.info("Socket connected");
        kucoin.subscribeTo("/market/ticker:all");
      });
      kucoin.onEvent("close", () => {
        kucoin.unsubscribeFrom("/market/ticker:all");
      });
      await kucoin.start();

      /**
       * Kucoin Socket Events: all-tickers
       * @param ticker
       * @returns void
       * @description This event is triggered when the socket receives a message from Kucoin
       */
      kucoin.onEvent("all-tickers", (ticker) => {
        const message = {
          tokenPrice: {
            pair: `${ticker.message.data.baseAsset}-${ticker.message.data.quoteAsset}`,
            priceNumber: ticker.message.data.price,
          },
          exchange: "kucoin",
        };

        server.publish(IoTokenRoom.PRICES, JSON.stringify(message));
      });

      // Handle shutdown
      setupSignals(() => {
        logger.warn(`Shutting down with ${server.pendingRequests} pending http requests...`);

        kucoin.disconnect();
        server.stop();
        process.exit(0);
      });
    },
  );
}

await bootstrap();
