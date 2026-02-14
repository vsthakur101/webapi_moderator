import axios from 'axios';
import type {
  Request,
  RequestListItem,
  Rule,
  RuleCreate,
  ProxyStatus,
  SystemProxyStatus,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Requests API
export async function getRequests(params?: {
  method?: string;
  host?: string;
  status_code?: number;
  search?: string;
  is_websocket?: boolean;
  limit?: number;
  offset?: number;
}): Promise<RequestListItem[]> {
  const { data } = await api.get('/requests', { params });
  return data;
}

export async function getRequest(id: string): Promise<Request> {
  const { data } = await api.get(`/requests/${id}`);
  return data;
}

export async function deleteRequest(id: string): Promise<void> {
  await api.delete(`/requests/${id}`);
}

export async function clearRequests(): Promise<void> {
  await api.delete('/requests');
}

export async function addTags(id: string, tags: string[]): Promise<{ tags: string[] }> {
  const { data } = await api.post(`/requests/${id}/tags`, tags);
  return data;
}

// Rules API
export async function getRules(): Promise<Rule[]> {
  const { data } = await api.get('/rules');
  return data;
}

export async function createRule(rule: RuleCreate): Promise<Rule> {
  const { data } = await api.post('/rules', rule);
  return data;
}

export async function getRule(id: string): Promise<Rule> {
  const { data } = await api.get(`/rules/${id}`);
  return data;
}

export async function updateRule(id: string, rule: Partial<RuleCreate>): Promise<Rule> {
  const { data } = await api.patch(`/rules/${id}`, rule);
  return data;
}

export async function deleteRule(id: string): Promise<void> {
  await api.delete(`/rules/${id}`);
}

export async function toggleRule(id: string): Promise<{ enabled: boolean }> {
  const { data } = await api.post(`/rules/${id}/toggle`);
  return data;
}

// Proxy API
export async function getProxyStatus(): Promise<ProxyStatus> {
  const { data } = await api.get('/proxy/status');
  return data;
}

export async function startProxy(): Promise<void> {
  await api.post('/proxy/start');
}

export async function stopProxy(): Promise<void> {
  await api.post('/proxy/stop');
}

export async function toggleIntercept(): Promise<{ intercept_enabled: boolean }> {
  const { data } = await api.post('/proxy/intercept/toggle');
  return data;
}

export async function handleInterceptAction(action: {
  request_id: string;
  action: 'forward' | 'drop' | 'forward_modified';
  modified_headers?: Record<string, string>;
  modified_body_b64?: string;
  modified_status?: number;
}): Promise<void> {
  await api.post('/proxy/intercept/action', action);
}

export async function replayRequest(params: {
  request_id: string;
  modified_method?: string;
  modified_url?: string;
  modified_headers?: Record<string, string>;
  modified_body_b64?: string;
}): Promise<{
  status_code: number;
  headers: Record<string, string>;
  body_b64: string;
}> {
  const { data } = await api.post('/proxy/replay', params);
  return data;
}

export async function getCertificate(): Promise<{
  certificate: string;
  instructions: string;
}> {
  const { data } = await api.get('/proxy/certificate');
  return data;
}

// System proxy (host OS)
export async function getSystemProxyStatus(): Promise<SystemProxyStatus> {
  const { data } = await api.get('/proxy/system/status');
  return data;
}

export async function enableSystemProxy(params: {
  host?: string;
  port?: number;
  bypass?: string[];
}): Promise<SystemProxyStatus> {
  const { data } = await api.post('/proxy/system/enable', params);
  return data;
}

export async function disableSystemProxy(): Promise<SystemProxyStatus> {
  const { data } = await api.post('/proxy/system/disable');
  return data;
}
