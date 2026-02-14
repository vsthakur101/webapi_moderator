export interface Request {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  host: string;
  path: string;
  scheme?: string;
  request_headers?: Record<string, string>;
  request_body_b64?: string;
  request_content_type?: string;
  response_status?: number;
  response_headers?: Record<string, string>;
  response_body_b64?: string;
  response_content_type?: string;
  duration_ms?: number;
  is_websocket: boolean;
  intercepted: boolean;
  modified: boolean;
  tags?: string[];
}

export interface RequestListItem {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  host: string;
  path: string;
  response_status?: number;
  duration_ms?: number;
  is_websocket: boolean;
  intercepted: boolean;
  modified: boolean;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  match_type: 'url' | 'header' | 'body' | 'method';
  match_pattern: string;
  match_regex: boolean;
  action_type: 'replace' | 'add_header' | 'remove_header' | 'block';
  action_target?: string;
  action_value?: string;
  apply_to: 'request' | 'response' | 'both';
  created_at: string;
  updated_at: string;
}

export interface RuleCreate {
  name: string;
  enabled?: boolean;
  priority?: number;
  match_type: 'url' | 'header' | 'body' | 'method';
  match_pattern: string;
  match_regex?: boolean;
  action_type: 'replace' | 'add_header' | 'remove_header' | 'block';
  action_target?: string;
  action_value?: string;
  apply_to?: 'request' | 'response' | 'both';
}

export interface ProxyStatus {
  state: 'running' | 'stopped' | 'error';
  host: string;
  port: number;
  intercept_enabled: boolean;
  requests_intercepted: number;
  requests_total: number;
  error_message?: string;
}

export interface InterceptedRequest {
  id: string;
  method: string;
  url: string;
  host: string;
  path: string;
  headers: Record<string, string>;
  body_b64?: string;
  is_response: boolean;
  response_status?: number;
}

export interface WebSocketMessage {
  type: 'new_request' | 'intercept' | 'proxy_status' | 'websocket_message';
  data: any;
}
