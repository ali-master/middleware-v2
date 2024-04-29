import Prometheus from "prom-client";
import { serviceName } from "@root/utils/logger.util";
import { version } from "bun";

export const monitoring = new Prometheus.Registry();

monitoring.setDefaultLabels({
  app: serviceName,
  bunVersion: version,
});
Prometheus.collectDefaultMetrics({ register: monitoring });
const http_request_counter = new Prometheus.Counter({
  name: "http_request_count",
  help: "Count of HTTP requests made to middleware",
  labelNames: ["method", "route"],
});
monitoring.registerMetric(http_request_counter);
export function incrementRequestCounter(payload: { method: string; route: string }) {
  http_request_counter.labels(payload).inc();
}

const http_response_duration = new Prometheus.Gauge({
  name: "http_request_duration",
  help: "Duration of HTTP requests made to middleware",
  labelNames: ["handler", "duration"],
});
monitoring.registerMetric(http_response_duration);
export function incrementResponseDuration(payload: { handler: string; duration: number }) {
  http_response_duration.labels(payload).inc(1);
}
