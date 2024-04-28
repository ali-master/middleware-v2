import { from } from "env-var";
import { SystemLogger } from "@root/utils/logger.util";

const log = SystemLogger.child({ module: "Process ENV" });
const envInstance = from(process.env, {}, (varname, str) => {
  log.debug(`Environment variable ${varname} with Value: ${str} loaded`);
});

export class CommonConfig {
  static readonly ENV = envInstance
    .get("NODE_ENV")
    .default("development")
    .asEnum(["development", "production"]);
  static readonly PORT = envInstance.get("PORT").required().asPortNumber();
  static readonly IS_DEVELOPMENT = CommonConfig.ENV === "development";
  static readonly IS_PRODUCTION = CommonConfig.ENV === "production";
  static readonly MAX_LISTENERS = envInstance.get("MAX_LISTENERS").required().asIntPositive();
  static readonly MIDDLEWARE_WS_URL = envInstance.get("MIDDLEWARE_WS_URL").required().asArray();
  static readonly KUCOIN_BASE_URL = envInstance.get("KUCOIN_BASE_URL").required().asUrlString();
  static readonly KUCOIN_OPENAPI_BASE_URL = envInstance
    .get("KUCOIN_OPENAPI_BASE_URL")
    .required()
    .asUrlString();
  static readonly KUCOIN_OPENAPI_VERSION = envInstance
    .get("KUCOIN_OPENAPI_VERSION")
    .required()
    .asIntPositive();
  static readonly MIDDLEWARE_WS_RECONNECT_TIMEOUT = envInstance
    .get("MIDDLEWARE_WS_RECONNECT_TIMEOUT")
    .required()
    .asString();
  static readonly PROXY_MAX_REQUEST_TIMEOUT = envInstance
    .get("PROXY_MAX_REQUEST_TIMEOUT")
    .required()
    .asString();
}
