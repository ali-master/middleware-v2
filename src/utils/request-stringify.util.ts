import fastJson from "fast-json-stringify";

/**
 * Request schema for ProxyService.proxy
 * @param {string} reqUrl - The URL to proxy to
 * @param {string} method - The HTTP method to use
 * @param {object} body - The body of the request
 * @param {object} headers - The headers of the request
 * @returns {object} - The request object
 * @example
 * {
 *  reqUrl: "https://example.com",
 *  method: "GET",
 *  body: {},
 * }
 */
export const reqStringify = fastJson({
  title: `ProxyService.proxy.request`,
  type: "object",
  properties: {
    reqUrl: {
      type: "string",
    },
    method: {
      type: "string",
    },
    body: {
      type: "object",
    },
    headers: {
      type: "object",
    },
  },
});
export const resStringify = fastJson({
  title: `ProxyService.proxy.response`,
  type: "object",
  properties: {
    code: {
      type: "string",
    },
    data: {
      type: "null",
    },
    msg: {
      type: "string",
    },
  },
});
