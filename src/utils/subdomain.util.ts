export function getSubdomain(domain: string) {
  return domain.split("://")[1].split(".")[0];
}
