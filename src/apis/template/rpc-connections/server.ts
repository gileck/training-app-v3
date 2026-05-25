export * from './index';

import {
  API_RPC_CONNECTION_CONNECT,
  API_RPC_CONNECTION_DAEMON_STATUS,
  API_RPC_CONNECTION_GET_CURRENT,
  API_RPC_CONNECTION_LIST_HISTORY,
  API_RPC_CONNECTION_STOP,
  API_RPC_CONNECTION_TEST,
} from './index';
import { connect } from './handlers/connect';
import { daemonStatus } from './handlers/daemonStatus';
import { getCurrent } from './handlers/getCurrent';
import { listHistory } from './handlers/listHistory';
import { stop } from './handlers/stop';
import { test } from './handlers/test';

export const rpcConnectionsApiHandlers = {
  [API_RPC_CONNECTION_CONNECT]: { process: connect },
  [API_RPC_CONNECTION_GET_CURRENT]: { process: getCurrent },
  [API_RPC_CONNECTION_STOP]: { process: stop },
  [API_RPC_CONNECTION_TEST]: { process: test },
  [API_RPC_CONNECTION_LIST_HISTORY]: { process: listHistory },
  [API_RPC_CONNECTION_DAEMON_STATUS]: { process: daemonStatus },
};
