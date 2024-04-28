import Prometheus from "prom-client";
import { serviceName } from "@root/utils/logger.util";

export const monitoring = new Prometheus.Registry();

monitoring.setDefaultLabels({
  app: serviceName,
});
Prometheus.collectDefaultMetrics({ register: monitoring });
const http_request_counter = new Prometheus.Counter({
  name: "http_request_count",
  help: "Count of HTTP requests made to middleware",
  labelNames: ["method", "route"],
});
monitoring.registerMetric(http_request_counter);
export function incrementCounter(payload: { method: string; route: string }) {
  http_request_counter.labels(payload).inc();
}
