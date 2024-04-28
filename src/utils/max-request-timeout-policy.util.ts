import { Effect } from "effect";
import { CommonConfig } from "@root/utils/configs";
// Types
import type { DurationInput } from "effect/Duration";

/**
 * Get the Max Request Timeout Policy
 */
export function getMaxRequestTimeoutPolicy() {
  return Effect.timeout(CommonConfig.PROXY_MAX_REQUEST_TIMEOUT as DurationInput);
}
