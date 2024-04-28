import { KucoinBaseResponseDto } from "@root/dto/kucoin-base-response.dto";

export interface OrderbookSymbolPriceModel {
  time: number;
  sequence: string;
  price: string;
  size: string;
  bestBid: string;
  bestBidSize: string;
  bestAsk: string;
  bestAskSize: string;
}

export class OrderbookSymbolPriceDto extends KucoinBaseResponseDto<OrderbookSymbolPriceModel> {
  toJSON?() {
    return {
      price: Number(this.data.price),
      bestBid: Number(this.data.bestBid),
      bestAsk: Number(this.data.bestAsk),
      size: Number(this.data.size),
      bestBidSize: Number(this.data.bestBidSize),
      bestAskSize: Number(this.data.bestAskSize),
    };
  }

  constructor(payload: Partial<OrderbookSymbolPriceDto>) {
    super(payload.data);
  }
}
