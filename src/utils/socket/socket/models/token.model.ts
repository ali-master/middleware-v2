interface InstanceServer {
  endpoint: string;
  protocol: string;
  encrypt: boolean;
  pingInterval: number;
  pingTimeout: number;
}

interface TokenData {
  token: string;
  instanceServers: InstanceServer[];
}

export interface Token {
  code: string;
  data: TokenData;
}
