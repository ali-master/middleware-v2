import ms from "ms";
import WebSocket from "ws";
import { Effect, Schedule } from "effect";
import { randomBytes } from "crypto";
import { EventEmitter } from "events";
import { SystemLogger, getRandomId, CommonConfig } from "@root/utils";
import { httpInstance, noop } from "@root/utils/socket/socket/utils";
// Enums
import { ReservedEventsChannel } from "@root/utils/socket/socket/enums";
// Types
import type {
  Token,
  MessageData,
  SocketOptions,
  BaseEventModel,
  MarketTickerModel,
} from "@root/utils/socket/socket/models";
import type { SubscriptionModel } from "@root/utils/socket/socket/models/events/subscription.model";
import { DurationInput } from "effect/Duration";

export class KucoinWsClient extends EventEmitter {
  public readonly logger: typeof SystemLogger;
  private readonly lengthConnectId = 24;
  private readonly retryTimeoutMs = ms("1s");
  private readonly retrySubscriptionMs = ms("2s");
  private readonly maxWaitingForEventMs = ms("2s");
  private readonly bulletEndPointPath: string = "/api/{bulletVersion}/bullet-{bullet}";
  private wsPath: URL;
  private ws?: WebSocket;
  private socketOpen: boolean;
  private socketConnecting: boolean;
  private askingClose: boolean;
  private connectId: string;
  private pingIntervalMs: number;
  private pingTimer: Timer;
  private readonly options: SocketOptions;
  private readonly mapResolveWaitEvent = new Map<string, () => void>();
  private lastTickerEventContact = Date.now();

  constructor(options: SocketOptions) {
    super();

    this.options = options;
    options.bulletVersion ??= "v1";
    this.bulletEndPointPath = this.bulletEndPointPath.replace(
      "{bulletVersion}",
      options.bulletVersion,
    );
    this.bulletEndPointPath = this.bulletEndPointPath.replace(
      "{bullet}",
      options.isPrivate ? "private" : "public",
    );
    this.retryTimeoutMs = ms(this.options.retryTimeoutMs ?? "1s");
    this.retrySubscriptionMs = ms(this.options.retrySubscriptionMs ?? "2s");
    this.maxWaitingForEventMs = ms(this.options.maxWaitingForEventMs ?? "2s");
    this.socketOpen = false;
    this.askingClose = false;
    this.logger = options.logger ?? SystemLogger.child({ scope: "kucoin-socket" });
  }

  async start() {
    this.logger.info("Connecting the Socket...");
    const policy = Schedule.addDelay(
      Schedule.recurWhile(() => {
        this.logger.info("Checking the Socket connection status...");
        const isConnected = this.isSocketOpen;
        if (!isConnected) {
          this.logger.info("The Socket is not connected yet. Retrying...");
        }

        return !isConnected;
      }),
      () => CommonConfig.MIDDLEWARE_WS_RECONNECT_TIMEOUT as DurationInput,
    );
    const connectEffect = Effect.promise(() => this.connect());
    const monitorEffect = Effect.promise(() => this.monitor());
    const repeatEffect = Effect.repeat(connectEffect, policy);
    await Effect.runPromise(Effect.all([repeatEffect, monitorEffect])).catch((error) => {
      this.logger.error(`Failed to reconnect the middleware socket: ${error}`);
      process.exit(0);
    });
  }

  private async monitor() {
    this.logger.info("Monitoring the Socket connection...");

    const connectEffect = Effect.sync(() => {
      let now = Date.now();
      const diff = now - this.lastTickerEventContact;
      const isIdle = diff > 2000; // 2 seconds idle time before reconnecting
      if (isIdle) {
        this.logger.info("The Socket is idle. Reconnecting...");
        this.reconnect();
      }
    });

    setInterval(() => {
      Effect.runSync(connectEffect);
    }, 1000);
  }

  async connect(): Promise<void> {
    this.socketConnecting = true;
    const axiosInstance = httpInstance({
      version: this.options.version,
      authVersion: this.options.authVersion,
      apiAuth: {
        key: this.options.apiAuth?.key,
        secret: this.options.apiAuth?.secret,
        passphrase: this.options.apiAuth?.passphrase,
      },
      baseURL: this.options.baseURL,
    });
    const response = await axiosInstance.post<Token>(this.bulletEndPointPath, {
      headers: { host: this.options.baseURL },
    });
    const data = (response as unknown as Token).data;
    if (!data || !data.token) {
      const invalidTokenError = new Error("Invalid token from KuCoin");

      this.socketConnecting = false;
      this.emitEvent(ReservedEventsChannel.ERROR, invalidTokenError);
      throw invalidTokenError;
    }

    const {
      token,
      instanceServers: [{ endpoint, pingInterval }],
    } = data;
    this.askingClose = false;
    this.connectId = randomBytes(this.lengthConnectId).toString("hex");
    this.pingIntervalMs = pingInterval;
    this.wsPath = new URL(endpoint);
    this.wsPath.searchParams.append("token", token);
    this.wsPath.searchParams.append("connectId", this.connectId);

    await this.openWebsocketConnection();
  }
  private async reconnect() {
    if (this.isSocketOpen || this.isSocketConnecting) {
      return;
    }

    this.emitEvent(ReservedEventsChannel.RECONNECT, `reconnect socket connection...`);
    const connect = Effect.promise(() => this.connect());
    const retry = Effect.delay(connect, this.retryTimeoutMs);
    await Effect.runPromise(retry);
  }

  waitForEvent(
    event: string,
    id: string,
    callback: (result: boolean) => void = noop,
  ): Promise<boolean> {
    const eventKey = `${event}-${id}`;

    return new Promise((resolve) => {
      const cb = (result: boolean) => {
        if (this.mapResolveWaitEvent.has(eventKey)) {
          this.mapResolveWaitEvent.delete(eventKey);
          resolve(result);
          callback(result);
        }
      };

      this.mapResolveWaitEvent.set(eventKey, () => cb(true));
      setTimeout(() => cb(false), this.maxWaitingForEventMs).unref();
    });
  }

  private processMessage(message: string): void {
    const payload = JSON.parse(message) as MessageData;
    const eventKey = `${payload.type}-${payload.id}`;

    if (this.mapResolveWaitEvent.has(eventKey)) {
      this.mapResolveWaitEvent.get(eventKey)!();

      return;
    }

    if (payload.type === "welcome") {
      this.emitEvent("welcome", payload);

      return;
    }

    if (payload.type === "pong") {
      this.emitEvent("pong", payload);

      return;
    }

    if (payload.type === "error") {
      const error = new Error(payload.data as string);

      this.emitEvent("error", error);

      return;
    }

    if (payload.topic === "/market/ticker:all") {
      const [baseAsset, quoteAsset] = payload.subject.split("-");
      this.emitEvent(
        "all-tickers",
        {
          data: Object.assign({}, payload.data, {
            baseAsset,
            quoteAsset,
          }),
        }
      );
      return;
    } else if (payload.subject === "trade.ticker") {
      const [baseAsset, quoteAsset] = payload.topic.split(":")[1].split("-");
      this.emitEvent(
        payload.subject,
        {
          data: Object.assign({}, payload.data, {
            baseAsset,
            quoteAsset,
          })
        },
      );
      return;
    }

    this.emitEvent<MessageData>(payload.subject ?? payload.type, payload);
  }

  private send(data: string, sendCb = noop) {
    if (!this.ws) {
      return;
    }

    this.ws.send(
      data,
      {
        compress: true,
      },
      sendCb,
    );
  }

  subscribeTo(topic: string): void {
    this.logger.info(`Subscribing to ${topic}`);
    const subFn = () => {
      if (!this.ws?.readyState) {
        this.emitEvent(ReservedEventsChannel.SOCKET_NOT_READY, {
          topic,
          message: `socket is not ready, retrying in ${this.retryTimeoutMs}ms`,
        });
        setTimeout(() => subFn(), this.retryTimeoutMs).unref();

        return;
      }

      const message: Record<string, string | boolean> = {
        id: getRandomId(),
        type: "subscribe",
        topic,
        response: true,
      };
      if (this.options.isPrivate) {
        message.privateChannel = true;
      }
      this.send(JSON.stringify(message), (error?: Error) => {
        if (error) {
          this.emitEvent(ReservedEventsChannel.ERROR, error);
          setTimeout(() => {
            this.emitEvent(ReservedEventsChannel.RETRY_SUBSCRIPTION, {
              topic,
              message: `retry to subscribe ${topic}, retrying in ${this.retrySubscriptionMs}ms`,
            });
            this.subscribeTo(topic);
          }, this.retrySubscriptionMs).unref();
          return;
        }
        this.emitEvent(ReservedEventsChannel.SUBSCRIPTION, {
          topic,
          message: `subscribed to ${topic}`,
        });
      });
    };

    if (!this.isSocketOpen) {
      setTimeout(() => {
        subFn();
      }, this.retrySubscriptionMs).unref();

      return;
    }

    subFn();
  }

  unsubscribeFrom(topic: string): void {
    if (!this.isSocketOpen) {
      return;
    }

    const message: Record<string, string | boolean> = {
      id: getRandomId(),
      type: "unsubscribe",
      topic,
      response: true,
    };
    if (this.options.isPrivate) {
      message.privateChannel = true;
    }
    this.send(JSON.stringify(message), (error?: Error) => {
      if (error) {
        this.emitEvent(ReservedEventsChannel.ERROR, error);
      } else {
        this.emitEvent(ReservedEventsChannel.UNSUBSCRIPTION, {
          topic,
          message: `unsubscribed from ${topic}`,
        });
      }
    });
  }

  disconnect(): void {
    if (!this.isSocketOpen) {
      return;
    }

    this.stopPing();
    this.ws?.close();
  }

  get isSocketOpen(): boolean {
    return !!this.ws && this.socketOpen;
  }

  get isSocketConnecting(): boolean {
    return this.socketConnecting;
  }

  private sendPing() {
    if (!this.isSocketOpen) {
      return;
    }

    const pingId = `ping-${Date.now()}`;
    void this.waitForEvent("pong", pingId, (result: boolean) => {
      if (result) {
        return;
      }
    });

    this.send(
      JSON.stringify({
        id: pingId,
        type: "ping",
      }),
    );
  }

  private startPing() {
    this.stopPing();

    this.pingTimer = setInterval(() => this.sendPing(), this.pingIntervalMs);
  }

  private stopPing() {
    clearInterval(this.pingTimer as unknown as number);
  }

  private async openWebsocketConnection(): Promise<void> {
    if (this.socketOpen) {
      return;
    }

    this.ws = new WebSocket(this.wsPath, {
      perMessageDeflate: false,
      handshakeTimeout: this.retryTimeoutMs,
    });

    this.ws.on("message", (data: string) => {
      this.processMessage(data);
    });

    this.ws.on("close", () => {
      this.socketOpen = false;
      this.stopPing();
      this.ws = undefined;

      this.emitEvent(ReservedEventsChannel.CLOSE, `socket is closed now`);

      if (!this.askingClose) {
        this.reconnect();
      }
    });

    this.ws.on("error", (_: WebSocket, error: Error) => {
      this.emitEvent(ReservedEventsChannel.ERROR, error);
    });

    await this.waitOpenSocket();
    this.startPing();
    await this.waitForEvent("welcome", this.connectId);

    this.socketOpen = true;
    this.socketConnecting = false;
  }

  private waitOpenSocket(): Promise<void> {
    return new Promise((resolve) => {
      this.ws?.on("open", () => {
        this.emitEvent(ReservedEventsChannel.OPEN, `socket is open now`);
        resolve();
      });
    });
  }

  private emitEvent(
    eventName:
      | "open"
      | "pong"
      | "welcome"
      | "reconnect"
      | "socket-not-ready"
      | "subscription"
      | "unsubscription"
      | "retry-subscription",
    message: MessageData<any> | string,
  ): void;
  private emitEvent<T>(eventName: string, message: T): void;
  private emitEvent(eventName: "error", message: Error): void;
  private emitEvent(eventName: "trade.ticker", message: MarketTickerModel): void;
  private emitEvent(eventName: "all-tickers", message: MarketTickerModel): void;
  private emitEvent(eventName: any, message: any) {
    const isError = message instanceof Error;
    const event = isError ? ReservedEventsChannel.ERROR : eventName;
    const cause = isError ? message.message : null;
    const stack = isError ? message.stack : null;
    const payload = {
      message: message instanceof Error ? message.message : message,
      event,
      cause,
      stack,
      isError,
      error: isError ? message : null,
      timestamp: Date.now(),
    } satisfies BaseEventModel<any>;

    if (eventName === "all-tickers" || eventName === "trade.ticker") {
      this.lastTickerEventContact = Date.now();
    }

    this.emit(eventName, payload);
    this.emit("*", payload);
  }

  /**
   * Listen to all events that are emitted from the socket connection
   * @param eventName
   * @param callback
   */
  public onEvent(
    eventName: "*",
    callback: (message: BaseEventModel<MarketTickerModel | string | Error>) => void,
  ): void;
  /**
   * Listen to all events that are emitted from the socket connection and is not specific to any other reserved events
   * @param eventName
   * @param callback
   */
  public onEvent(eventName: string, callback: (message: BaseEventModel<string>) => void): void;
  /**
   * Specific Error response event listener when subscribing to `error`
   * @param eventName
   * @param callback
   */
  public onEvent(eventName: "error", callback: (error: BaseEventModel<Error>) => void): void;
  /**
   * Specific Open response event listener when subscribing to `open`
   * @param eventName
   * @param callback
   */
  public onEvent(eventName: "open", callback: (message: BaseEventModel<string>) => void): void;
  /**
   * Specific Reconnect response event listener when subscribing to `reconnect`
   * @param eventName
   * @param callback
   */
  public onEvent(eventName: "reconnect", callback: (message: BaseEventModel<string>) => void): void;
  /**
   * Specific Socket not ready response event listener when subscribing to `socket-not-ready`
   * @param eventName
   * @param callback
   */
  public onEvent(
    eventName: "socket-not-ready",
    callback: (message: BaseEventModel<string>) => void,
  ): void;
  /**
   * Specific Subscription response event listener when subscribing to `subscription`
   * @param eventName
   * @param callback
   */
  public onEvent(
    eventName: "subscription",
    callback: (message: BaseEventModel<SubscriptionModel>) => void,
  ): void;
  /**
   * Specific Retry Subscription response event listener when subscribing to `retry-subscription`
   * @param eventName
   * @param callback
   */
  public onEvent(
    eventName: "retry-subscription",
    callback: (message: BaseEventModel<SubscriptionModel>) => void,
  ): void;
  public onEvent(
    eventName: "unsubscription",
    callback: (message: BaseEventModel<SubscriptionModel>) => void,
  ): void;
  /**
   * Specific Close response event listener when subscribing to `close`
   * @param eventName
   * @param callback
   */
  public onEvent(eventName: "close", callback: (message: BaseEventModel<string>) => void): void;
  /**
   * Specific Market Ticker response event listener when subscribing to `market/ticker:all`
   * @param eventName
   * @param callback
   */
  public onEvent(
    eventName: "all-tickers",
    callback: (message: BaseEventModel<MarketTickerModel>) => void,
  ): void; /**
   * Specific Market Ticker response event listener when subscribing to `market/ticker:BTC-USDT` or any other market pair
   * @param eventName
   * @param callback
   */
  public onEvent(
    eventName: "trade.ticker",
    callback: (message: BaseEventModel<MarketTickerModel>) => void,
  ): void;
  /**
   * Specific Market Ticker response event listener when subscribing to `market/ticker:all`
   * @param eventName The event name to listen to for the response message
   * @param callback
   *
   * @example
   * ```typescript
   * $kucoinPrivate.onEvent("BTC-USDT", (message) => {
   *  console.log(message);
   *  {
   *   message: {
   *     "symbol": "BTC-USDT",
   *     "time": 1631533200000,
   *     "sequence": 1631533200000,
   *     "price": "1000",
   *     "size": "0.1",
   *     "bestBid": "999",
   *     "bestBidSize": "0.1",
   *     "bestAsk": "1001",
   *     "bestAskSize": "0.1",
   *     "baseAsset": "BTC",
   *     "quoteAsset": "USDT"
   *   },
   *   isError: false,
   *   cause: undefined,
   *   stack: undefined,
   *   error: undefined,
   *   event: "BTC-USDT"
   *  }
   */
  public onEvent<
    Subject extends string = string,
    D extends string = "-",
    R extends string = Uppercase<Subject>,
  >(
    /**
     * Split the event name into two parts if it contains a hyphen `-` character
     * and infer the two parts as `A` and `B` respectively and return the concatenated string as the event name type
     */
    eventName: R extends `${infer A}${D}${infer B}` ? `${A}${D}${B}` : R,
    callback: (message: BaseEventModel<MarketTickerModel>) => void,
  ): void;
  public onEvent(eventName: any, callback: any) {
    this.on(eventName, (...args) => {
      callback(...args);
    });
  }
}
