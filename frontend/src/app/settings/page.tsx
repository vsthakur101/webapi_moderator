'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getProxyStatus, getCertificate, getSystemProxyStatus, enableSystemProxy, disableSystemProxy } from '@/lib/api';
import type { ProxyStatus, SystemProxyStatus } from '@/types';
import { Download, Copy, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [certificate, setCertificate] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [systemProxy, setSystemProxy] = useState<SystemProxyStatus | null>(null);
  const [systemProxyError, setSystemProxyError] = useState<string | null>(null);
  const [isSystemProxyUpdating, setIsSystemProxyUpdating] = useState(false);

  const proxyHost = proxyStatus?.host || 'localhost';
  const proxyPort = proxyStatus?.port?.toString() || '8080';
  const proxyAddress = `${proxyHost}:${proxyPort}`;
  const noProxyList = 'localhost,127.0.0.1';

  useEffect(() => {
    getProxyStatus().then(setProxyStatus);
    getSystemProxyStatus()
      .then(setSystemProxy)
      .catch((error) => {
        console.error('Failed to load system proxy status:', error);
        setSystemProxyError('System proxy status unavailable. Run the backend on the host OS to manage it.');
      });
  }, []);

  const handleDownloadCertificate = async () => {
    try {
      const data = await getCertificate();
      setCertificate(data.certificate);

      // Download as file
      const blob = new Blob([data.certificate], { type: 'application/x-pem-file' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'webapi-moderator-ca.pem';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download certificate:', err);
      alert('Failed to download certificate. Make sure the proxy has been started at least once.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnableSystemProxy = async () => {
    setIsSystemProxyUpdating(true);
    setSystemProxyError(null);
    try {
      const result = await enableSystemProxy({
        host: proxyHost,
        port: Number(proxyPort),
        bypass: noProxyList.split(',').map((entry) => entry.trim()).filter(Boolean),
      });
      setSystemProxy(result);
    } catch (error) {
      console.error('Failed to enable system proxy:', error);
      alert('Failed to enable system proxy. Ensure the backend is running on the host OS.');
    } finally {
      setIsSystemProxyUpdating(false);
    }
  };

  const handleDisableSystemProxy = async () => {
    setIsSystemProxyUpdating(true);
    setSystemProxyError(null);
    try {
      const result = await disableSystemProxy();
      setSystemProxy(result);
    } catch (error) {
      console.error('Failed to disable system proxy:', error);
      alert('Failed to disable system proxy. Ensure the backend is running on the host OS.');
    } finally {
      setIsSystemProxyUpdating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure the proxy and view connection information</p>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl space-y-6">
          {/* Proxy Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Proxy Configuration</CardTitle>
              <CardDescription>Configure your browser or system to use this proxy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Proxy Host</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={proxyHost} readOnly />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(proxyHost)}
                    >
                      {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Proxy Port</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={proxyPort} readOnly />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(proxyPort)}
                    >
                      {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">System-wide interception</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  To intercept all browser traffic on this machine, set the OS system proxy to this address.
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Automatic enable/disable requires the backend to run on the host OS (not inside Docker).
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(proxyAddress)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy proxy address
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(noProxyList)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy no-proxy list
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Suggested bypass list: {noProxyList}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleEnableSystemProxy}
                    disabled={isSystemProxyUpdating}
                  >
                    {isSystemProxyUpdating ? 'Updating...' : 'Enable system proxy'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDisableSystemProxy}
                    disabled={isSystemProxyUpdating}
                  >
                    Disable system proxy
                  </Button>
                  {systemProxy?.supported && (
                    <span className="text-xs text-muted-foreground">
                      Status: {systemProxy.enabled ? 'Enabled' : 'Disabled'} ({systemProxy.os})
                    </span>
                  )}
                </div>
                {systemProxyError && (
                  <p className="text-xs text-red-500 mt-2">{systemProxyError}</p>
                )}
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Quick Setup</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <strong>macOS:</strong> System Settings → Network → (Active) → Details → Proxies → Web Proxy (HTTP) & Secure Web Proxy (HTTPS)
                  </p>
                  <p>
                    <strong>Windows:</strong> Settings → Network & Internet → Proxy → Manual proxy setup
                  </p>
                  <p>
                    <strong>Firefox:</strong> Settings → Network Settings → Manual proxy configuration
                  </p>
                  <p>
                    <strong>Chrome/Edge:</strong> Uses system proxy settings
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SSL Certificate */}
          <Card>
            <CardHeader>
              <CardTitle>SSL Certificate</CardTitle>
              <CardDescription>
                Install the CA certificate to intercept HTTPS traffic
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                To intercept HTTPS traffic, you need to install and trust the WebAPI Moderator CA certificate.
                This allows the proxy to decrypt and re-encrypt HTTPS traffic for inspection.
              </p>

              <Button onClick={handleDownloadCertificate}>
                <Download className="w-4 h-4 mr-2" />
                Download CA Certificate
              </Button>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Installation Instructions</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <strong>macOS:</strong> Double-click the .pem file → Add to Keychain → Open Keychain Access → Find the certificate → Get Info → Trust → Always Trust
                  </p>
                  <p>
                    <strong>Windows:</strong> Double-click the .pem file → Install Certificate → Current User → Place in "Trusted Root Certification Authorities"
                  </p>
                  <p>
                    <strong>Firefox:</strong> Settings → Privacy & Security → Certificates → View Certificates → Import
                  </p>
                  <p>
                    <strong>Chrome:</strong> Uses system certificate store
                  </p>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
                <h4 className="font-medium text-yellow-500 mb-2">Security Warning</h4>
                <p className="text-sm text-muted-foreground">
                  Installing this certificate allows the proxy to intercept all HTTPS traffic.
                  Only install this certificate on development/testing machines.
                  Remove the certificate when you're done testing.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* API Information */}
          <Card>
            <CardHeader>
              <CardTitle>API Information</CardTitle>
              <CardDescription>Connect to the WebAPI Moderator API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">API URL</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value="http://localhost:8000/api" readOnly />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard('http://localhost:8000/api')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">WebSocket URL</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value="ws://localhost:8000/ws" readOnly />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard('ws://localhost:8000/ws')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
