export class TimeoutException extends Error {
  constructor() {
    const message = "Request Timeout, please try again later.";
    const trueProto = new.target.prototype;

    super(message);

    this.name = "TimeoutException";
    this.message = message;

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, trueProto);
    Error.captureStackTrace(this, this.constructor);
  }
}
