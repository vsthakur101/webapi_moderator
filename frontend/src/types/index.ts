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

export interface SystemProxyStatus {
  supported: boolean;
  enabled: boolean;
  os: string;
  host?: string | null;
  port?: number | null;
  bypass?: string[];
  message?: string | null;
}

// Decoder types
export type EncodingType = 'url' | 'base64' | 'html' | 'hex' | 'unicode' | 'gzip';
export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512';

export interface EncodeResponse {
  output: string;
  encoding: EncodingType;
  success: boolean;
  error?: string;
}

export interface DecodeResponse {
  output: string;
  encoding: EncodingType;
  success: boolean;
  error?: string;
}

export interface HashResponse {
  output: string;
  algorithm: HashAlgorithm;
  success: boolean;
  error?: string;
}

export interface DecodingStep {
  encoding: string;
  input: string;
  output: string;
}

export interface SmartDecodeResponse {
  output: string;
  steps: DecodingStep[];
  success: boolean;
  error?: string;
}

// Comparer types
export type CompareSourceType = 'request' | 'text';

export interface CompareSource {
  type: CompareSourceType;
  id?: string;
  content?: string;
}

export interface CompareOptions {
  ignore_whitespace: boolean;
  ignore_case: boolean;
}

export interface DiffLine {
  type: 'equal' | 'insert' | 'delete' | 'replace';
  left_line_num?: number;
  right_line_num?: number;
  left_content?: string;
  right_content?: string;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  unchanged: number;
}

export interface CompareResponse {
  diff: DiffLine[];
  stats: DiffStats;
  success: boolean;
  error?: string;
}

// Collection types
export interface Collection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  item_count: number;
}

export interface CollectionCreate {
  name: string;
  description?: string;
  color?: string;
}

export interface CollectionItem {
  id: string;
  collection_id: string;
  request_id: string;
  notes?: string;
  order: number;
  added_at: string;
}

export interface CollectionDetail extends Omit<Collection, 'item_count'> {
  items: CollectionItem[];
}

// Target types
export interface Target {
  id: string;
  host: string;
  in_scope: boolean;
  notes?: string;
  request_count: number;
  first_seen: string;
  last_seen: string;
}

export interface SiteMapNode {
  id: string;
  target_id: string;
  path: string;
  parent_path?: string;
  node_type: 'folder' | 'file' | 'param';
  methods: string[];
  status_codes: number[];
  content_types: string[];
  parameters: string[];
  request_count: number;
  first_seen: string;
  last_seen: string;
}

export interface SiteMapTreeNode {
  name: string;
  path: string;
  node_type: string;
  methods: string[];
  status_codes: number[];
  request_count: number;
  children: SiteMapTreeNode[];
}

// Intruder types
export type AttackType = 'sniper' | 'battering_ram' | 'pitchfork' | 'cluster_bomb';
export type AttackStatus = 'configured' | 'running' | 'paused' | 'completed' | 'error';

export interface Position {
  start: number;
  end: number;
  index: number;
}

export interface IntruderAttack {
  id: string;
  name: string;
  base_request_id?: string;
  attack_type: AttackType;
  status: AttackStatus;
  method: string;
  url_template: string;
  headers_template: Record<string, string>;
  body_template?: string;
  positions: Position[];
  payload_sets: string[][];
  threads: number;
  delay_ms: number;
  follow_redirects: boolean;
  timeout_seconds: number;
  total_requests: number;
  completed_requests: number;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface IntruderAttackCreate {
  name: string;
  base_request_id?: string;
  attack_type?: AttackType;
  method?: string;
  url_template: string;
  headers_template?: Record<string, string>;
  body_template?: string;
  positions?: Position[];
  payload_sets?: string[][];
  threads?: number;
  delay_ms?: number;
  follow_redirects?: boolean;
  timeout_seconds?: number;
}

export interface IntruderResult {
  id: string;
  attack_id: string;
  position_index: number;
  payloads: string[];
  request_url: string;
  response_status?: number;
  response_length?: number;
  response_time_ms?: number;
  error?: string;
  timestamp: string;
}

export interface BuiltinPayloadList {
  name: string;
  description: string;
  count: number;
}

// Sequencer types
export type SequencerStatus = 'configured' | 'collecting' | 'analyzing' | 'completed' | 'error';
export type ExtractionType = 'header' | 'cookie' | 'body_regex' | 'body_json';

export interface SequencerAnalysis {
  id: string;
  name: string;
  status: SequencerStatus;
  source_request_id?: string;
  extraction_type: ExtractionType;
  extraction_pattern: string;
  sample_count: number;
  collected_count: number;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface SequencerAnalysisDetail extends SequencerAnalysis {
  samples: string[];
  analysis_results?: AnalysisResults;
}

export interface CharacterFrequency {
  character: string;
  count: number;
  percentage: number;
}

export interface EntropyResult {
  entropy_bits: number;
  max_entropy: number;
  efficiency: number;
  rating: string;
}

export interface PatternResult {
  has_sequential: boolean;
  has_repeated: boolean;
  common_prefixes: string[];
  common_suffixes: string[];
}

export interface AnalysisResults {
  total_samples: number;
  unique_samples: number;
  min_length: number;
  max_length: number;
  avg_length: number;
  character_set: string[];
  character_frequencies: CharacterFrequency[];
  entropy: EntropyResult;
  patterns: PatternResult;
  recommendation: string;
}

// Spider types
export type SpiderStatus = 'configured' | 'running' | 'paused' | 'completed' | 'error';
export type SpiderURLStatus = 'queued' | 'crawling' | 'crawled' | 'error' | 'skipped';

export interface SpiderSession {
  id: string;
  name: string;
  target_id?: string;
  status: SpiderStatus;
  start_urls: string[];
  max_depth: number;
  max_pages: number;
  threads: number;
  delay_ms: number;
  include_patterns: string[];
  exclude_patterns: string[];
  respect_robots_txt: boolean;
  follow_external_links: boolean;
  pages_crawled: number;
  pages_queued: number;
  error_count: number;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface SpiderSessionCreate {
  name: string;
  target_id?: string;
  start_urls: string[];
  max_depth?: number;
  max_pages?: number;
  threads?: number;
  delay_ms?: number;
  include_patterns?: string[];
  exclude_patterns?: string[];
  respect_robots_txt?: boolean;
  follow_external_links?: boolean;
}

export interface SpiderURL {
  id: string;
  session_id: string;
  url: string;
  depth: number;
  status: SpiderURLStatus;
  source_url?: string;
  response_status?: number;
  content_type?: string;
  content_length?: number;
  response_time_ms?: number;
  title?: string;
  links_found: number;
  forms_found: number;
  error_message?: string;
  discovered_at: string;
  crawled_at?: string;
}

export interface SpiderSessionDetail extends SpiderSession {
  discovered_urls: SpiderURL[];
}

// Scanner types
export type ScanStatus = 'configured' | 'running' | 'paused' | 'completed' | 'error';
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IssueConfidence = 'certain' | 'firm' | 'tentative';
export type IssueStatus = 'new' | 'confirmed' | 'false_positive' | 'fixed';

export interface ScanConfiguration {
  id: string;
  name: string;
  description?: string;
  enabled_checks: string[];
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ScanConfigCreate {
  name: string;
  description?: string;
  enabled_checks?: string[];
  settings?: Record<string, any>;
}

export interface Scan {
  id: string;
  name: string;
  config_id?: string;
  target_id?: string;
  status: ScanStatus;
  source_type: string;
  source_request_id?: string;
  source_urls: string[];
  total_checks: number;
  completed_checks: number;
  issues_found: number;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ScanCreate {
  name: string;
  config_id?: string;
  target_id?: string;
  source_type?: string;
  source_request_id?: string;
  source_urls?: string[];
  enabled_checks?: string[];
}

export interface ScanIssue {
  id: string;
  scan_id: string;
  issue_type: string;
  severity: IssueSeverity;
  confidence: IssueConfidence;
  url: string;
  method: string;
  parameter?: string;
  location?: string;
  request_data?: Record<string, any>;
  response_data?: Record<string, any>;
  evidence?: string;
  payload?: string;
  title: string;
  description?: string;
  remediation?: string;
  references: string[];
  status: IssueStatus;
  notes?: string;
  discovered_at: string;
}

export interface ScanDetail extends Scan {
  issues: ScanIssue[];
}

export interface CheckInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
}

export interface IssueSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}
