'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getProxyStatus, getCertificate } from '@/lib/api';
import type { ProxyStatus } from '@/types';
import { Download, Copy, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [certificate, setCertificate] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getProxyStatus().then(setProxyStatus);
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
                    <Input value={proxyStatus?.host || 'localhost'} readOnly />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(proxyStatus?.host || 'localhost')}
                    >
                      {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Proxy Port</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={proxyStatus?.port?.toString() || '8080'} readOnly />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(proxyStatus?.port?.toString() || '8080')}
                    >
                      {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Quick Setup</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <strong>macOS:</strong> System Preferences → Network → Advanced → Proxies → Web Proxy (HTTP) & Secure Web Proxy (HTTPS)
                  </p>
                  <p>
                    <strong>Windows:</strong> Settings → Network & Internet → Proxy → Manual proxy setup
                  </p>
                  <p>
                    <strong>Firefox:</strong> Settings → Network Settings → Manual proxy configuration
                  </p>
                  <p>
                    <strong>Chrome:</strong> Uses system proxy settings
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
