import { Effect } from "effect";
import {
  SystemLogger,
  CommonConfig,
  addDashBetweenPair,
  getMaxRequestTimeoutPolicy,
} from "@root/utils";
import * as Http from "@effect/platform/HttpClient";
import { reqStringify } from "@root/utils/request-stringify.util";
// Types
import type { Method } from "@effect/platform/src/Http/Method";
// DTOs
import { OrderbookSymbolPriceDto } from "@root/dto";

export class ProxyService {
  private readonly logger = SystemLogger.child({ service: "ProxyService" });
  /**
   * Timeout policy for requests to other services or APIs
   * The Max Request Timeout Policy is set to 60 seconds to prevent the service from waiting indefinitely for a response which may never come
   * The Policy value's loaded from the CommonConfig file which is based on the environment the service is running in
   * @private
   * @readonly
   * @memberof ProxyService
   * @example
   * const timeoutPolicy = getMaxRequestTimeoutPolicy();
   * const req = Http.request
   * .get('https://example.com', {
   * acceptJson: true,
   * })
   * .pipe(Http.client.fetch, timeoutPolicy, Http.response.json);
   * const response = await Effect.runPromise(req);
   * console.log(response);
   * // Output: { data: 'example' }
   */
  private readonly timeoutPolicy = getMaxRequestTimeoutPolicy();

  /**
   * Proxy request to another service
   * @param ctx - Request context object containing request URL, method, body and headers
   * @returns Response from the proxied service
   * @throws Error if the request fails
   * @example
   * const response = await ProxyService.proxy({
   *  reqUrl: 'https://example.com',
   *  method: 'GET',
   *  body: null,
   *  headers: {
   *  'Content-Type': 'application/json',
   *  },
   *  });
   *  console.log(response);
   *  // Output: { data: 'example' }
   */
  async proxy(ctx: { reqUrl: string; method: Method; body: any; headers: any }) {
    this.logger.info({
      data: reqStringify(ctx),
    });
    const req = Http.request
      .make(ctx.method)(ctx.reqUrl, {
        body: ctx.body,
        headers: ctx.headers,
        acceptJson: true,
      })
      .pipe(Http.client.fetch, this.timeoutPolicy, Http.response.json);

    return Effect.runPromise(req);
  }

  /**
   * Get Kucoin market pair price
   * @param pair - Market pair
   * @returns Market pair price
   * @throws Error if the request fails
   * @example
   * const price = await ProxyService.getMarketPair('BTC-USDT');
   * console.log(price); // Output: { symbol: 'BTC-USDT', price: 50000 }
   *
   */
  async getMarketPair(pair: string) {
    this.logger.info({
      data: reqStringify({ pair }),
    });

    const symbol = addDashBetweenPair(pair);
    const reqUrl = this.pairUrl(symbol);
    const req = Http.request
      .get(reqUrl, {
        acceptJson: true,
      })
      .pipe(
        Http.client.fetch,
        this.timeoutPolicy,
        Http.response.json,
        Effect.andThen((result) => new OrderbookSymbolPriceDto(result).toJSON()),
      );

    const { price } = await Effect.runPromise(req);

    return {
      symbol,
      price,
    };
  }

  private pairUrl(pair: string): string {
    return `${CommonConfig.KUCOIN_BASE_URL}/api/v1/market/orderbook/level1?symbol=${pair}`;
  }
}
