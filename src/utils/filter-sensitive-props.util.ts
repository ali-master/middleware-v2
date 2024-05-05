const { SensitiveParamFilter } = require("@amaabca/sensitive-param-filter");

// local sensitive params via env variable or default
const sensitiveParams = process.env.SENSITIVE_PARAMS?.split(",") ?? [
  "password",
  "authorization",
  "KC-API-PASSPHRASE",
  "KC-API-KEY",
];
export const paramFilter = new SensitiveParamFilter({
  filterUnknown: false,
  replacement: "[FILTERED]",
  params: sensitiveParams,
});

export function filterSensitiveProps(info: any) {
  return paramFilter.filter(info);
}
