import { IoExchange } from "@root/enums/token.enum";

export interface TokenPriceInMarket {
  tokenPrice: PricingMarketSymbol;
  exchange: IoExchange;
}

export interface PricingMarketSymbol {
  pair: string;
  priceNumber: number;
}
