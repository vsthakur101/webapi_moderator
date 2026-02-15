'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { encodeData, decodeData, hashData, smartDecode } from '@/lib/api';
import type { EncodingType, HashAlgorithm, DecodingStep } from '@/types';
import { ArrowRight, ArrowDown, Copy, Trash2, Wand2 } from 'lucide-react';

const ENCODING_TYPES: { value: EncodingType; label: string }[] = [
  { value: 'url', label: 'URL' },
  { value: 'base64', label: 'Base64' },
  { value: 'html', label: 'HTML' },
  { value: 'hex', label: 'Hex' },
  { value: 'unicode', label: 'Unicode' },
  { value: 'gzip', label: 'Gzip (Base64)' },
];

const HASH_ALGORITHMS: { value: HashAlgorithm; label: string }[] = [
  { value: 'md5', label: 'MD5' },
  { value: 'sha1', label: 'SHA-1' },
  { value: 'sha256', label: 'SHA-256' },
  { value: 'sha512', label: 'SHA-512' },
];

export default function DecoderPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [selectedEncoding, setSelectedEncoding] = useState<EncodingType>('base64');
  const [selectedHash, setSelectedHash] = useState<HashAlgorithm>('sha256');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [smartDecodeSteps, setSmartDecodeSteps] = useState<DecodingStep[]>([]);

  const handleEncode = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setError(null);
    setSmartDecodeSteps([]);
    try {
      const result = await encodeData(input, selectedEncoding);
      if (result.success) {
        setOutput(result.output);
      } else {
        setError(result.error || 'Encoding failed');
        setOutput('');
      }
    } catch (err) {
      setError('Failed to encode data');
      setOutput('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecode = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setError(null);
    setSmartDecodeSteps([]);
    try {
      const result = await decodeData(input, selectedEncoding);
      if (result.success) {
        setOutput(result.output);
      } else {
        setError(result.error || 'Decoding failed');
        setOutput('');
      }
    } catch (err) {
      setError('Failed to decode data');
      setOutput('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHash = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setError(null);
    setSmartDecodeSteps([]);
    try {
      const result = await hashData(input, selectedHash);
      if (result.success) {
        setOutput(result.output);
      } else {
        setError(result.error || 'Hashing failed');
        setOutput('');
      }
    } catch (err) {
      setError('Failed to hash data');
      setOutput('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSmartDecode = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await smartDecode(input);
      if (result.success) {
        setOutput(result.output);
        setSmartDecodeSteps(result.steps);
      } else {
        setError(result.error || 'Smart decode failed');
        setOutput('');
        setSmartDecodeSteps([]);
      }
    } catch (err) {
      setError('Failed to smart decode data');
      setOutput('');
      setSmartDecodeSteps([]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const clearAll = () => {
    setInput('');
    setOutput('');
    setError(null);
    setSmartDecodeSteps([]);
  };

  const swapInputOutput = () => {
    setInput(output);
    setOutput('');
    setError(null);
    setSmartDecodeSteps([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold">Decoder</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Encode, decode, and hash data in various formats
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl space-y-6">
          <Tabs defaultValue="encode-decode" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="encode-decode">Encode/Decode</TabsTrigger>
              <TabsTrigger value="hash">Hash</TabsTrigger>
              <TabsTrigger value="smart">Smart Decode</TabsTrigger>
            </TabsList>

            {/* Encode/Decode Tab */}
            <TabsContent value="encode-decode" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Encode/Decode</CardTitle>
                  <CardDescription>Transform data between different encoding formats</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Encoding Type Selection */}
                  <div className="flex flex-wrap gap-2">
                    {ENCODING_TYPES.map((enc) => (
                      <Button
                        key={enc.value}
                        variant={selectedEncoding === enc.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedEncoding(enc.value)}
                      >
                        {enc.label}
                      </Button>
                    ))}
                  </div>

                  {/* Input/Output */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Input</label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(input)}
                          disabled={!input}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <textarea
                        className="w-full h-48 p-3 bg-muted rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Enter text to encode or decode..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Output</label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(output)}
                          disabled={!output}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <textarea
                        className="w-full h-48 p-3 bg-muted rounded-lg font-mono text-sm resize-none focus:outline-none"
                        placeholder="Output will appear here..."
                        value={output}
                        readOnly
                      />
                    </div>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm text-red-500">
                      {error}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleEncode} disabled={isLoading || !input.trim()}>
                      Encode <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button onClick={handleDecode} disabled={isLoading || !input.trim()}>
                      Decode <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button variant="outline" onClick={swapInputOutput} disabled={!output}>
                      <ArrowDown className="w-4 h-4 mr-2" /> Use Output as Input
                    </Button>
                    <Button variant="outline" onClick={clearAll}>
                      <Trash2 className="w-4 h-4 mr-2" /> Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Hash Tab */}
            <TabsContent value="hash" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Hash Generator</CardTitle>
                  <CardDescription>Generate cryptographic hashes of your data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Hash Algorithm Selection */}
                  <div className="flex flex-wrap gap-2">
                    {HASH_ALGORITHMS.map((alg) => (
                      <Button
                        key={alg.value}
                        variant={selectedHash === alg.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedHash(alg.value)}
                      >
                        {alg.label}
                      </Button>
                    ))}
                  </div>

                  {/* Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Input</label>
                    <textarea
                      className="w-full h-32 p-3 bg-muted rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter text to hash..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                  </div>

                  {/* Output */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Hash Output</label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(output)}
                        disabled={!output}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all min-h-[40px]">
                      {output || <span className="text-muted-foreground">Hash will appear here...</span>}
                    </div>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm text-red-500">
                      {error}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleHash} disabled={isLoading || !input.trim()}>
                      Generate Hash
                    </Button>
                    <Button variant="outline" onClick={clearAll}>
                      <Trash2 className="w-4 h-4 mr-2" /> Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Smart Decode Tab */}
            <TabsContent value="smart" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Smart Decode</CardTitle>
                  <CardDescription>
                    Auto-detect encoding and recursively decode nested encodings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Encoded Input</label>
                    <textarea
                      className="w-full h-32 p-3 bg-muted rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Paste encoded data here (URL-encoded, Base64, etc.)..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                  </div>

                  {/* Action Button */}
                  <Button onClick={handleSmartDecode} disabled={isLoading || !input.trim()}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Smart Decode
                  </Button>

                  {/* Decoding Steps */}
                  {smartDecodeSteps.length > 0 && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium">Decoding Steps</label>
                      <div className="space-y-2">
                        {smartDecodeSteps.map((step, index) => (
                          <div key={index} className="bg-muted/50 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium bg-primary/20 text-primary px-2 py-1 rounded">
                                Step {index + 1}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Detected: <span className="font-medium">{step.encoding.toUpperCase()}</span>
                              </span>
                            </div>
                            <div className="font-mono text-xs break-all text-muted-foreground">
                              {step.output.length > 200 ? step.output.slice(0, 200) + '...' : step.output}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Final Output */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Final Decoded Output</label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(output)}
                        disabled={!output}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <textarea
                      className="w-full h-32 p-3 bg-muted rounded-lg font-mono text-sm resize-none focus:outline-none"
                      placeholder="Decoded output will appear here..."
                      value={output}
                      readOnly
                    />
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm text-red-500">
                      {error}
                    </div>
                  )}

                  {/* Clear Button */}
                  <Button variant="outline" onClick={clearAll}>
                    <Trash2 className="w-4 h-4 mr-2" /> Clear
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Quick Reference Card */}
          <Card>
            <CardHeader>
              <CardTitle>Encoding Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-1">URL Encoding</h4>
                  <p className="text-muted-foreground">
                    Encodes special characters as %XX (e.g., space = %20)
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Base64</h4>
                  <p className="text-muted-foreground">
                    Binary-to-text encoding using A-Z, a-z, 0-9, +, /
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">HTML Entities</h4>
                  <p className="text-muted-foreground">
                    Encodes characters as &amp;name; or &amp;#num; (e.g., &amp;lt; for &lt;)
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Hex</h4>
                  <p className="text-muted-foreground">
                    Represents bytes as hexadecimal pairs (e.g., 48656c6c6f = Hello)
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Unicode</h4>
                  <p className="text-muted-foreground">
                    Escape sequences like \u0041 for Unicode characters
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Gzip</h4>
                  <p className="text-muted-foreground">
                    Compresses data using DEFLATE algorithm (output is Base64)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
