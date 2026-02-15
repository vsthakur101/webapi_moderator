import axios from 'axios';
import type {
  Request,
  RequestListItem,
  Rule,
  RuleCreate,
  ProxyStatus,
  SystemProxyStatus,
  EncodingType,
  HashAlgorithm,
  EncodeResponse,
  DecodeResponse,
  HashResponse,
  SmartDecodeResponse,
  CompareSource,
  CompareOptions,
  CompareResponse,
  Collection,
  CollectionCreate,
  CollectionDetail,
  CollectionItem,
  Target,
  SiteMapTreeNode,
  SiteMapNode,
  IntruderAttack,
  IntruderAttackCreate,
  IntruderResult,
  BuiltinPayloadList,
  SequencerAnalysis,
  SequencerAnalysisDetail,
  ExtractionType,
  AnalysisResults,
  SpiderSession,
  SpiderSessionCreate,
  SpiderSessionDetail,
  SpiderURL,
  ScanConfiguration,
  ScanConfigCreate,
  Scan,
  ScanCreate,
  ScanDetail,
  ScanIssue,
  CheckInfo,
  IssueSummary,
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

// Decoder API
export async function encodeData(
  input: string,
  encoding: EncodingType
): Promise<EncodeResponse> {
  const { data } = await api.post('/decoder/encode', { input, encoding });
  return data;
}

export async function decodeData(
  input: string,
  encoding: EncodingType
): Promise<DecodeResponse> {
  const { data } = await api.post('/decoder/decode', { input, encoding });
  return data;
}

export async function hashData(
  input: string,
  algorithm: HashAlgorithm
): Promise<HashResponse> {
  const { data } = await api.post('/decoder/hash', { input, algorithm });
  return data;
}

export async function smartDecode(
  input: string,
  maxIterations: number = 10
): Promise<SmartDecodeResponse> {
  const { data } = await api.post('/decoder/smart-decode', {
    input,
    max_iterations: maxIterations,
  });
  return data;
}

// Comparer API
export async function compareDiff(
  left: CompareSource,
  right: CompareSource,
  options?: CompareOptions
): Promise<CompareResponse> {
  const { data } = await api.post('/comparer/diff', { left, right, options });
  return data;
}

// Collections API
export async function getCollections(): Promise<Collection[]> {
  const { data } = await api.get('/collections');
  return data;
}

export async function createCollection(collection: CollectionCreate): Promise<Collection> {
  const { data } = await api.post('/collections', collection);
  return data;
}

export async function getCollection(id: string): Promise<CollectionDetail> {
  const { data } = await api.get(`/collections/${id}`);
  return data;
}

export async function updateCollection(
  id: string,
  collection: Partial<CollectionCreate>
): Promise<Collection> {
  const { data } = await api.patch(`/collections/${id}`, collection);
  return data;
}

export async function deleteCollection(id: string): Promise<void> {
  await api.delete(`/collections/${id}`);
}

export async function addToCollection(
  collectionId: string,
  requestId: string,
  notes?: string
): Promise<CollectionItem> {
  const { data } = await api.post(`/collections/${collectionId}/items`, {
    request_id: requestId,
    notes,
  });
  return data;
}

export async function removeFromCollection(
  collectionId: string,
  itemId: string
): Promise<void> {
  await api.delete(`/collections/${collectionId}/items/${itemId}`);
}

export async function updateCollectionItem(
  collectionId: string,
  itemId: string,
  updates: { notes?: string; order?: number }
): Promise<CollectionItem> {
  const { data } = await api.patch(
    `/collections/${collectionId}/items/${itemId}`,
    updates
  );
  return data;
}

export async function reorderCollectionItems(
  collectionId: string,
  itemIds: string[]
): Promise<void> {
  await api.post(`/collections/${collectionId}/items/reorder`, {
    item_ids: itemIds,
  });
}

// Targets API
export async function getTargets(): Promise<Target[]> {
  const { data } = await api.get('/targets');
  return data;
}

export async function getTarget(id: string): Promise<Target> {
  const { data } = await api.get(`/targets/${id}`);
  return data;
}

export async function updateTarget(
  id: string,
  updates: { in_scope?: boolean; notes?: string }
): Promise<Target> {
  const { data } = await api.patch(`/targets/${id}`, updates);
  return data;
}

export async function deleteTarget(id: string): Promise<void> {
  await api.delete(`/targets/${id}`);
}

export async function getSiteMap(targetId: string): Promise<SiteMapTreeNode[]> {
  const { data } = await api.get(`/targets/${targetId}/sitemap`);
  return data;
}

export async function getSiteMapFlat(targetId: string): Promise<SiteMapNode[]> {
  const { data } = await api.get(`/targets/${targetId}/sitemap/flat`);
  return data;
}

export async function rebuildSiteMap(): Promise<{ message: string; targets: number; nodes: number }> {
  const { data } = await api.post('/targets/rebuild');
  return data;
}

// Intruder API
export async function getIntruderAttacks(): Promise<IntruderAttack[]> {
  const { data } = await api.get('/intruder/attacks');
  return data;
}

export async function createIntruderAttack(attack: IntruderAttackCreate): Promise<IntruderAttack> {
  const { data } = await api.post('/intruder/attacks', attack);
  return data;
}

export async function getIntruderAttack(id: string): Promise<IntruderAttack> {
  const { data } = await api.get(`/intruder/attacks/${id}`);
  return data;
}

export async function updateIntruderAttack(
  id: string,
  updates: Partial<IntruderAttackCreate>
): Promise<IntruderAttack> {
  const { data } = await api.patch(`/intruder/attacks/${id}`, updates);
  return data;
}

export async function deleteIntruderAttack(id: string): Promise<void> {
  await api.delete(`/intruder/attacks/${id}`);
}

export async function startIntruderAttack(id: string): Promise<void> {
  await api.post(`/intruder/attacks/${id}/start`);
}

export async function pauseIntruderAttack(id: string): Promise<void> {
  await api.post(`/intruder/attacks/${id}/pause`);
}

export async function resumeIntruderAttack(id: string): Promise<void> {
  await api.post(`/intruder/attacks/${id}/resume`);
}

export async function stopIntruderAttack(id: string): Promise<void> {
  await api.post(`/intruder/attacks/${id}/stop`);
}

export async function getIntruderResults(
  attackId: string,
  limit: number = 100,
  offset: number = 0
): Promise<IntruderResult[]> {
  const { data } = await api.get(`/intruder/attacks/${attackId}/results`, {
    params: { limit, offset },
  });
  return data;
}

export async function getBuiltinPayloads(): Promise<BuiltinPayloadList[]> {
  const { data } = await api.get('/intruder/payloads/builtin');
  return data;
}

export async function getBuiltinPayloadList(name: string): Promise<{ name: string; payloads: string[] }> {
  const { data } = await api.get(`/intruder/payloads/builtin/${name}`);
  return data;
}

// Sequencer API
export async function getSequencerAnalyses(): Promise<SequencerAnalysis[]> {
  const { data } = await api.get('/sequencer/analyses');
  return data;
}

export async function createSequencerAnalysis(analysis: {
  name: string;
  source_request_id?: string;
  extraction_type: ExtractionType;
  extraction_pattern: string;
  sample_count?: number;
}): Promise<SequencerAnalysis> {
  const { data } = await api.post('/sequencer/analyses', analysis);
  return data;
}

export async function getSequencerAnalysis(id: string): Promise<SequencerAnalysisDetail> {
  const { data } = await api.get(`/sequencer/analyses/${id}`);
  return data;
}

export async function deleteSequencerAnalysis(id: string): Promise<void> {
  await api.delete(`/sequencer/analyses/${id}`);
}

export async function addSequencerSamples(
  analysisId: string,
  samples: string[]
): Promise<{ collected_count: number; sample_count: number }> {
  const { data } = await api.post(`/sequencer/analyses/${analysisId}/add-samples`, samples);
  return data;
}

export async function runSequencerAnalysis(analysisId: string): Promise<AnalysisResults> {
  const { data } = await api.post(`/sequencer/analyses/${analysisId}/analyze`);
  return data;
}

export async function resetSequencerAnalysis(analysisId: string): Promise<void> {
  await api.post(`/sequencer/analyses/${analysisId}/reset`);
}

export async function analyzeTokensManual(tokens: string[]): Promise<AnalysisResults> {
  const { data } = await api.post('/sequencer/analyze-manual', { tokens });
  return data;
}

// Spider API
export async function getSpiderSessions(): Promise<SpiderSession[]> {
  const { data } = await api.get('/spider/sessions');
  return data;
}

export async function createSpiderSession(session: SpiderSessionCreate): Promise<SpiderSession> {
  const { data } = await api.post('/spider/sessions', session);
  return data;
}

export async function getSpiderSession(id: string): Promise<SpiderSessionDetail> {
  const { data } = await api.get(`/spider/sessions/${id}`);
  return data;
}

export async function updateSpiderSession(
  id: string,
  updates: Partial<SpiderSessionCreate>
): Promise<SpiderSession> {
  const { data } = await api.patch(`/spider/sessions/${id}`, updates);
  return data;
}

export async function deleteSpiderSession(id: string): Promise<void> {
  await api.delete(`/spider/sessions/${id}`);
}

export async function startSpiderSession(id: string): Promise<void> {
  await api.post(`/spider/sessions/${id}/start`);
}

export async function pauseSpiderSession(id: string): Promise<void> {
  await api.post(`/spider/sessions/${id}/pause`);
}

export async function resumeSpiderSession(id: string): Promise<void> {
  await api.post(`/spider/sessions/${id}/resume`);
}

export async function stopSpiderSession(id: string): Promise<void> {
  await api.post(`/spider/sessions/${id}/stop`);
}

export async function getSpiderURLs(
  sessionId: string,
  status?: string,
  limit: number = 100,
  offset: number = 0
): Promise<SpiderURL[]> {
  const { data } = await api.get(`/spider/sessions/${sessionId}/urls`, {
    params: { status, limit, offset },
  });
  return data;
}

// Scanner API

// Available checks
export async function getAvailableChecks(): Promise<CheckInfo[]> {
  const { data } = await api.get('/scanner/checks');
  return data;
}

// Scan Configurations
export async function getScanConfigs(): Promise<ScanConfiguration[]> {
  const { data } = await api.get('/scanner/configs');
  return data;
}

export async function createScanConfig(config: ScanConfigCreate): Promise<ScanConfiguration> {
  const { data } = await api.post('/scanner/configs', config);
  return data;
}

export async function getScanConfig(id: string): Promise<ScanConfiguration> {
  const { data } = await api.get(`/scanner/configs/${id}`);
  return data;
}

export async function updateScanConfig(
  id: string,
  updates: Partial<ScanConfigCreate>
): Promise<ScanConfiguration> {
  const { data } = await api.patch(`/scanner/configs/${id}`, updates);
  return data;
}

export async function deleteScanConfig(id: string): Promise<void> {
  await api.delete(`/scanner/configs/${id}`);
}

// Scans
export async function getScans(): Promise<Scan[]> {
  const { data } = await api.get('/scanner/scans');
  return data;
}

export async function createScan(scan: ScanCreate): Promise<Scan> {
  const { data } = await api.post('/scanner/scans', scan);
  return data;
}

export async function getScan(id: string): Promise<ScanDetail> {
  const { data } = await api.get(`/scanner/scans/${id}`);
  return data;
}

export async function updateScan(id: string, updates: Partial<ScanCreate>): Promise<Scan> {
  const { data } = await api.patch(`/scanner/scans/${id}`, updates);
  return data;
}

export async function deleteScan(id: string): Promise<void> {
  await api.delete(`/scanner/scans/${id}`);
}

export async function startScan(id: string, enabledChecks?: string[]): Promise<void> {
  await api.post(`/scanner/scans/${id}/start`, null, {
    params: { enabled_checks: enabledChecks },
  });
}

export async function pauseScan(id: string): Promise<void> {
  await api.post(`/scanner/scans/${id}/pause`);
}

export async function stopScan(id: string): Promise<void> {
  await api.post(`/scanner/scans/${id}/stop`);
}

export async function getScanIssues(
  scanId: string,
  params?: { severity?: string; issue_type?: string; status?: string }
): Promise<ScanIssue[]> {
  const { data } = await api.get(`/scanner/scans/${scanId}/issues`, { params });
  return data;
}

export async function getScanSummary(scanId: string): Promise<IssueSummary> {
  const { data } = await api.get(`/scanner/scans/${scanId}/summary`);
  return data;
}

export async function updateIssue(
  issueId: string,
  updates: { status?: string; notes?: string }
): Promise<ScanIssue> {
  const { data } = await api.patch(`/scanner/issues/${issueId}`, updates);
  return data;
}
