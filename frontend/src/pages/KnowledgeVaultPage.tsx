import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  Search, 
  RotateCcw,
  Sparkles,
  Lock,
  Trash2,
  Sliders,
  ExternalLink,
  Layers,
  BookOpen,
  AlertCircle
} from 'lucide-react';

interface DocumentItem {
  id: string;
  filename: string;
  original_filename: string;
  file_size_bytes: number;
  page_count: number;
  chunk_count: number;
  status: string;
  uploaded_at: string;
}

interface SearchMatch {
  chunk_id: string;
  document_id: string;
  filename?: string;
  page_number?: number;
  content: string;
  similarity: number;
}

export const KnowledgeVaultPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Diagnostic RAG Retrieval State
  const [searchQuery, setSearchQuery] = useState('');
  const [topK, setTopK] = useState(4);
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Failed to fetch documents', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/v1/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await fetchDocuments();
      } else {
        const errData = await res.json().catch(() => ({}));
        setUploadError(errData.detail || 'Upload and indexing failed.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Network error during upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch('/api/v1/documents/test-retrieval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, top_k: topK }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Search failed', err);
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to remove this document and its indexed vector chunks?')) return;
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/v1/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        setSearchResults((prev) => prev.filter((r) => r.document_id !== docId));
      }
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeletingId(null);
    }
  };

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0);
  const totalPages = documents.reduce((sum, d) => sum + (d.page_count || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              Confidential Knowledge Vault
            </span>
          </div>
          <h1 className="text-2xl font-bold text-offWhite font-sans">Grounded Document Intelligence</h1>
          <p className="text-xs text-mutedSilver">On-premise SQLite vector database powering verifiable Council citations.</p>
        </div>

        {/* Corpus Metrics Badges (Reference UI Style) */}
        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-full bg-cyan-950/50 border border-cyan-400/30 text-xs font-mono text-cyan-300">
            <span className="font-bold">{documents.length}</span> Documents
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-purple-950/50 border border-purple-400/30 text-xs font-mono text-purple-300">
            <span className="font-bold">{totalChunks}</span> Chunks
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,.txt"
        className="hidden"
      />

      {/* Upload Drag & Drop Zone */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="liquid-glass-secondary p-8 rounded-3xl border-2 border-dashed border-white/15 hover:border-cyan-400/50 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer group shadow-sm hover:scale-[1.005]"
      >
        <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-400/30 group-hover:bg-cyan-900/50 flex items-center justify-center text-cyan-300 mb-3 transition-colors shadow-[0_0_20px_rgba(69,217,245,0.25)]">
          {uploading ? (
            <RotateCcw className="w-7 h-7 animate-spin text-cyan-400" />
          ) : (
            <UploadCloud className="w-7 h-7" />
          )}
        </div>
        <h3 className="font-bold text-offWhite text-base font-sans">
          {uploading ? 'Extracting Text & Indexing Chunks...' : 'Upload Research Papers, Resumes, or Domain Documents'}
        </h3>
        <p className="text-xs text-mutedSilver mt-1">PDF and TXT formats supported. Vectorised with page-accurate citations.</p>
        
        {uploadError && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/50 border border-rose-500/30 px-3 py-1.5 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* ─── Diagnostic RAG Retrieval Lab ─── */}
      <div className="liquid-glass-primary p-6 rounded-3xl border border-white/10 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-offWhite font-mono">
              Diagnostic RAG Retrieval Lab
            </h3>
          </div>
          <span className="text-[11px] font-mono text-mutedSilver">
            Inspect exact passages, page numbers, and similarity rankings delivered to the Council
          </span>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Query documents (e.g. 'Arun Kumar skills and projects' or 'Byzantine fault tolerance')..."
              className="w-full bg-black/40 border border-white/15 focus:border-cyan-400/80 rounded-xl px-4 py-2.5 text-sm text-offWhite placeholder-gray-500 focus:outline-none transition-colors shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/50 border border-white/15 text-xs font-mono text-gray-300">
              <span>Top-K:</span>
              <select
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="bg-transparent text-cyan-300 font-bold focus:outline-none cursor-pointer"
              >
                <option value={3} className="bg-black">3</option>
                <option value={5} className="bg-black">5</option>
                <option value={8} className="bg-black">8</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-black font-semibold text-xs transition-all hover:bg-cyan-100 shadow-[0_0_15px_rgba(255,255,255,0.3)] cursor-pointer disabled:opacity-50"
            >
              {searching ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Test Retrieval</span>
            </button>
          </div>
        </form>

        {/* Diagnostic Results */}
        {hasSearched && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-mutedSilver">
              <span>Retrieved {searchResults.length} matching passage{searchResults.length !== 1 ? 's' : ''}</span>
              {searchResults.length === 0 && (
                <span className="text-amber-400">No chunks exceeded minimum relevance threshold</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {searchResults.map((r, idx) => (
                <div 
                  key={r.chunk_id || idx}
                  className="p-4 rounded-2xl bg-black/50 border border-white/10 hover:border-cyan-400/40 transition-colors space-y-2 shadow-inner"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-cyan-300 font-bold truncate max-w-[200px]">
                      {r.filename || 'Document'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-gray-300 text-[10px]">
                        Page {r.page_number || 1}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-cyan-950/70 border border-cyan-400/40 text-cyan-300 font-bold text-[10px]">
                        {(r.similarity * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-300 font-sans leading-relaxed line-clamp-4 italic">
                    "{r.content}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Indexed Documents Corpus Table ─── */}
      <div className="liquid-glass-primary rounded-3xl overflow-hidden border border-white/10 shadow-lg">
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-offWhite text-sm font-sans">
              Indexed Document Repository
            </h3>
          </div>
          <span className="text-xs font-mono text-mutedSilver">
            {loading ? 'Refreshing...' : `${documents.length} files available`}
          </span>
        </div>

        <div className="divide-y divide-white/5">
          {documents.length === 0 ? (
            <div className="p-10 text-center text-xs text-mutedSilver italic">
              No documents uploaded yet. Upload a PDF or TXT file above to activate Council grounding.
            </div>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-950/60 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-sm shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-offWhite font-sans tracking-tight">
                      {doc.original_filename}
                    </h4>
                    <div className="flex items-center gap-3 text-[11px] font-mono text-mutedSilver mt-1 flex-wrap">
                      <span>{(doc.file_size_bytes / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span>{doc.page_count} page{doc.page_count !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span className="text-cyan-300">{doc.chunk_count} vector chunks</span>
                      <span>•</span>
                      <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-300 bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{doc.status.toUpperCase()}</span>
                  </span>

                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="p-2 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 hover:border-rose-500/30 transition-colors cursor-pointer"
                    title="Delete document and vector index"
                  >
                    {deletingId === doc.id ? (
                      <RotateCcw className="w-4 h-4 animate-spin text-rose-400" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
