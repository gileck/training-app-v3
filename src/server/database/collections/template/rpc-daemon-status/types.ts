export interface RpcDaemonStatus {
  _id: 'singleton';
  lastHeartbeat: Date;
  startedAt: Date;
  hostname?: string;
}
