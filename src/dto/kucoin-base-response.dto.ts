export class KucoinBaseResponseDto<T> {
  code: string;
  data: T;

  constructor(data: T) {
    this.data = data;
  }
}
