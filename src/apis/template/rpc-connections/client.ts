import apiClient from '@/client/utils/apiClient';
import {
  API_RPC_CONNECTION_CONNECT,
  API_RPC_CONNECTION_CONNECT_OPTIONS,
  API_RPC_CONNECTION_CONNECT_VERIFY,
  API_RPC_CONNECTION_DAEMON_STATUS,
  API_RPC_CONNECTION_GET_CURRENT,
  API_RPC_CONNECTION_LIST_HISTORY,
  API_RPC_CONNECTION_STOP,
  API_RPC_CONNECTION_TEST,
} from './index';
import type {
  ConnectRequest,
  ConnectResponse,
  ConnectOptionsRequest,
  ConnectOptionsResponse,
  ConnectVerifyRequest,
  ConnectVerifyResponse,
  DaemonStatusRequest,
  DaemonStatusResponse,
  GetCurrentRequest,
  GetCurrentResponse,
  ListHistoryRequest,
  ListHistoryResponse,
  StopRequest,
  StopResponse,
  TestRpcRequest,
  TestRpcResponse,
} from './types';

export const apiConnectRpc = () =>
  apiClient.call<ConnectResponse, ConnectRequest>(
    API_RPC_CONNECTION_CONNECT,
    {} as ConnectRequest
  );

export const apiRpcConnectOptions = () =>
  apiClient.call<ConnectOptionsResponse, ConnectOptionsRequest>(
    API_RPC_CONNECTION_CONNECT_OPTIONS,
    {} as ConnectOptionsRequest
  );

export const apiRpcConnectVerify = (params: ConnectVerifyRequest) =>
  apiClient.call<ConnectVerifyResponse, ConnectVerifyRequest>(
    API_RPC_CONNECTION_CONNECT_VERIFY,
    params
  );

export const apiGetCurrentRpcConnection = () =>
  apiClient.call<GetCurrentResponse, GetCurrentRequest>(
    API_RPC_CONNECTION_GET_CURRENT,
    {} as GetCurrentRequest
  );

export const apiStopRpcConnection = () =>
  apiClient.call<StopResponse, StopRequest>(
    API_RPC_CONNECTION_STOP,
    {} as StopRequest
  );

export const apiTestRpc = (params: TestRpcRequest = {}) =>
  apiClient.call<TestRpcResponse, TestRpcRequest>(
    API_RPC_CONNECTION_TEST,
    params
  );

export const apiListRpcHistory = (params: ListHistoryRequest = {}) =>
  apiClient.call<ListHistoryResponse, ListHistoryRequest>(
    API_RPC_CONNECTION_LIST_HISTORY,
    params
  );

export const apiGetDaemonStatus = () =>
  apiClient.call<DaemonStatusResponse, DaemonStatusRequest>(
    API_RPC_CONNECTION_DAEMON_STATUS,
    {} as DaemonStatusRequest
  );
