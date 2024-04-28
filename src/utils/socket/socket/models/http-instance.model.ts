import { ApiKeyModel } from "src/utils/socket/socket";

export interface HttpInstanceModel {
  baseURL?: string;
  apiAuth?: ApiKeyModel;
  version?: string;
  /**
   * The version of the authentication that could be 1 or 2
   * @default 2
   * @optional
   * @type number
   */
  authVersion?: number;
}
