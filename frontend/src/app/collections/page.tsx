'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getCollections,
  createCollection,
  getCollection,
  deleteCollection,
  removeFromCollection,
  updateCollectionItem,
  getRequest,
} from '@/lib/api';
import type { Collection, CollectionDetail, CollectionItem } from '@/types';
import {
  FolderOpen,
  Plus,
  Trash2,
  ChevronLeft,
  FileText,
  StickyNote,
  Save,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CollectionsPage() {
  const queryClient = useQueryClient();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [newCollectionColor, setNewCollectionColor] = useState('#3b82f6');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState('');

  // Fetch collections
  const { data: collections = [], isLoading: collectionsLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: getCollections,
  });

  // Fetch selected collection details
  const { data: selectedCollection, isLoading: collectionLoading } = useQuery({
    queryKey: ['collection', selectedCollectionId],
    queryFn: () => getCollection(selectedCollectionId!),
    enabled: !!selectedCollectionId,
  });

  // Create collection mutation
  const createMutation = useMutation({
    mutationFn: createCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setIsCreating(false);
      setNewCollectionName('');
      setNewCollectionDescription('');
      setNewCollectionColor('#3b82f6');
    },
  });

  // Delete collection mutation
  const deleteMutation = useMutation({
    mutationFn: deleteCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setSelectedCollectionId(null);
    },
  });

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: ({ collectionId, itemId }: { collectionId: string; itemId: string }) =>
      removeFromCollection(collectionId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', selectedCollectionId] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: ({
      collectionId,
      itemId,
      updates,
    }: {
      collectionId: string;
      itemId: string;
      updates: { notes?: string };
    }) => updateCollectionItem(collectionId, itemId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', selectedCollectionId] });
      setEditingItemId(null);
      setEditingNotes('');
    },
  });

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    createMutation.mutate({
      name: newCollectionName.trim(),
      description: newCollectionDescription.trim() || undefined,
      color: newCollectionColor,
    });
  };

  const handleDeleteCollection = (id: string) => {
    if (confirm('Are you sure you want to delete this collection?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    if (!selectedCollectionId) return;
    removeItemMutation.mutate({
      collectionId: selectedCollectionId,
      itemId,
    });
  };

  const handleSaveNotes = (itemId: string) => {
    if (!selectedCollectionId) return;
    updateItemMutation.mutate({
      collectionId: selectedCollectionId,
      itemId,
      updates: { notes: editingNotes },
    });
  };

  const startEditingNotes = (item: CollectionItem) => {
    setEditingItemId(item.id);
    setEditingNotes(item.notes || '');
  };

  const COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold">Collections</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Organize and group requests for focused testing
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collections List */}
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <Button
              className="w-full"
              onClick={() => setIsCreating(true)}
              disabled={isCreating}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Collection
            </Button>
          </div>

          {/* Create Collection Form */}
          {isCreating && (
            <div className="p-4 border-b border-border bg-muted/50 space-y-3">
              <Input
                placeholder="Collection name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                autoFocus
              />
              <Input
                placeholder="Description (optional)"
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
              />
              <div className="flex gap-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      'w-6 h-6 rounded-full transition-transform',
                      newCollectionColor === color && 'ring-2 ring-offset-2 ring-primary'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCollectionColor(color)}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateCollection}
                  disabled={!newCollectionName.trim() || createMutation.isPending}
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewCollectionName('');
                    setNewCollectionDescription('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Collections List */}
          <div className="flex-1 overflow-auto p-2">
            {collectionsLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : collections.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No collections yet</p>
                <p className="text-xs mt-1">Create a collection to get started</p>
              </div>
            ) : (
              <div className="space-y-1">
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    className={cn(
                      'p-3 rounded-lg cursor-pointer transition-colors',
                      selectedCollectionId === collection.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                    onClick={() => setSelectedCollectionId(collection.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: collection.color || '#3b82f6' }}
                      />
                      <span className="font-medium truncate">{collection.name}</span>
                      <span
                        className={cn(
                          'ml-auto text-xs',
                          selectedCollectionId === collection.id
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground'
                        )}
                      >
                        {collection.item_count}
                      </span>
                    </div>
                    {collection.description && (
                      <p
                        className={cn(
                          'text-xs mt-1 truncate',
                          selectedCollectionId === collection.id
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground'
                        )}
                      >
                        {collection.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Collection Detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedCollectionId ? (
            collectionLoading ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : selectedCollection ? (
              <>
                {/* Collection Header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: selectedCollection.color || '#3b82f6' }}
                    />
                    <div>
                      <h2 className="font-semibold">{selectedCollection.name}</h2>
                      {selectedCollection.description && (
                        <p className="text-sm text-muted-foreground">
                          {selectedCollection.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteCollection(selectedCollection.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>

                {/* Collection Items */}
                <div className="flex-1 overflow-auto p-4">
                  {selectedCollection.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FileText className="w-12 h-12 mb-3 opacity-50" />
                      <p>No requests in this collection</p>
                      <p className="text-xs mt-1">
                        Add requests from the History page
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedCollection.items.map((item) => (
                        <CollectionItemCard
                          key={item.id}
                          item={item}
                          isEditing={editingItemId === item.id}
                          editingNotes={editingNotes}
                          onEditNotes={() => startEditingNotes(item)}
                          onSaveNotes={() => handleSaveNotes(item.id)}
                          onCancelEdit={() => {
                            setEditingItemId(null);
                            setEditingNotes('');
                          }}
                          onNotesChange={setEditingNotes}
                          onRemove={() => handleRemoveItem(item.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <FolderOpen className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">Select a collection</p>
              <p className="text-sm">Choose a collection from the left to view its contents</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Collection Item Card Component
function CollectionItemCard({
  item,
  isEditing,
  editingNotes,
  onEditNotes,
  onSaveNotes,
  onCancelEdit,
  onNotesChange,
  onRemove,
}: {
  item: CollectionItem;
  isEditing: boolean;
  editingNotes: string;
  onEditNotes: () => void;
  onSaveNotes: () => void;
  onCancelEdit: () => void;
  onNotesChange: (notes: string) => void;
  onRemove: () => void;
}) {
  const { data: request } = useQuery({
    queryKey: ['request', item.request_id],
    queryFn: () => getRequest(item.request_id),
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {request ? (
              <div className="font-mono text-sm">
                <span
                  className={cn(
                    'font-bold mr-2',
                    request.method === 'GET' && 'text-green-500',
                    request.method === 'POST' && 'text-blue-500',
                    request.method === 'PUT' && 'text-yellow-500',
                    request.method === 'DELETE' && 'text-red-500'
                  )}
                >
                  {request.method}
                </span>
                <span className="text-muted-foreground">{request.host}</span>
                {request.path}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Loading request...</div>
            )}

            {/* Notes */}
            {isEditing ? (
              <div className="mt-3 space-y-2">
                <textarea
                  className="w-full p-2 bg-muted rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Add notes..."
                  rows={3}
                  value={editingNotes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={onSaveNotes}>
                    <Save className="w-3 h-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={onCancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                {item.notes ? (
                  <p
                    className="text-sm text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={onEditNotes}
                  >
                    {item.notes}
                  </p>
                ) : (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    onClick={onEditNotes}
                  >
                    <StickyNote className="w-3 h-3" />
                    Add notes
                  </button>
                )}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
