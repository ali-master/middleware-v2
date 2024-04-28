import { HttpInstanceModel } from "src/utils/socket/socket";
import { SystemLogger } from "@root/utils";

export interface SocketOptions extends HttpInstanceModel {
  /**
   * The logger instance for the Kucoin socket manager
   * @default SystemLogger
   * @example SystemLogger
   * @example new SystemLogger()
   * @example new SystemLogger({ level: "debug" })
   * @example new SystemLogger({ level: "debug", name: "KucoinSocket" })
   */
  logger?: typeof SystemLogger;
  /**
   * Is the socket connection private or public?
   */
  isPrivate: boolean;
  /**
   * The version of the Kucoin Bullet engine to use which is used to send and receive messages
   * Values can be v1 or v2 or v3
   * @default v1
   */
  bulletVersion?: string;
  /**
   * Retry to send a topic if connection is not ready yet
   *
   * @default 2s
   */
  retryTimeoutMs?: string;
  /**
   * Retry to resend the subscription topic if faced to an error
   *
   */
  retrySubscriptionMs?: string;
  /**
   * Maximum waiting time for an event to be received
   * @default 2s
   */
  maxWaitingForEventMs?: string;
  /**
   * Debug mode
   *
   * @default false
   */
  debug?: boolean;
}
