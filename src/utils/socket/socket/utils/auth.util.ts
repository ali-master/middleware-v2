// Utilities
import CryptoJS from "crypto";
// Types
import type { BinaryToTextEncoding } from "crypto";
import type { ApiKeyModel } from "@root/providers/kucoin/socket/models/api-key.model";
import type { RawAxiosRequestHeaders } from "axios";

export function sign(text: string, secret: string, outputType = "base64") {
  return CryptoJS.createHmac("sha256", secret)
    .update(text)
    .digest(<BinaryToTextEncoding>outputType);
}

export function auth(options: {
  apiKey: ApiKeyModel;
  method: string;
  url: string;
  data: any;
  authVersion: string | number;
  version: string;
}): RawAxiosRequestHeaders {
  const { method, url, authVersion, version, apiKey, data } = options;
  const timestamp = Date.now();
  const signature = sign(
    timestamp + method.toUpperCase() + url + (JSON.stringify(data) ?? ""),
    apiKey.secret,
  );
  const payload: RawAxiosRequestHeaders = {
    "KC-API-KEY": apiKey.key,
    "KC-API-SIGN": signature,
    "KC-API-TIMESTAMP": timestamp.toString(),
    "KC-API-PASSPHRASE": apiKey.passphrase || "",
    "Content-Type": "application/json",
    "User-Agent": `BridgeSDK-v${version}`,
  };
  // For v2 API-KEY
  if (authVersion && (authVersion === 2 || authVersion === "2")) {
    payload["KC-API-KEY-VERSION"] = 2;
    payload["KC-API-PASSPHRASE"] = sign(apiKey.passphrase || "", apiKey.secret);
  }
  return payload;
}
