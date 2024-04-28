export function addDashBetweenPair(pair: string): string {
  if (checkUsdt(pair)) {
    return pair;
  }
  
  if(!pair.includes("USDT") && !pair.includes("-")) {
    return pair + "-USDT";
  }

  return pair.replace("USDT", "-USDT");
}

export function checkUsdt(pair: string) {
  return pair.endsWith("-USDT");
}
