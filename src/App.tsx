/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { generateKey, fileToBase64 } from "./lib/encryption";
import {
  saveDocument,
  getDocuments,
  getDocumentContent,
  deleteDocument,
  checkHasDocuments,
  type SecureDocument,
} from "./store";
import { auth, signInWithGoogle, signOutUser } from "./lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { Lock, FileText, Upload, Trash2, Eye, Download, LogOut, AlertCircle, ShieldCheck } from "lucide-react";
import { cn } from "./lib/utils";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [isAuthenticated, setIsAuthenticated] = useState(false); // Vault authenticated
  const [password, setPassword] = useState("");
  const [cryptoKey, setCryptoKey] = useState("");
  const [error, setError] = useState("");
  const [hasExistingDocs, setHasExistingDocs] = useState(false);
  
  const [documents, setDocuments] = useState<SecureDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ doc: SecureDocument; content: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
      if (user) {
        checkHasDocuments().then(setHasExistingDocs);
      } else {
        // Reset state on logout
        setIsAuthenticated(false);
        setPassword("");
        setCryptoKey("");
        setDocuments([]);
        setViewingDoc(null);
        setHasExistingDocs(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password) {
      setError("Please enter a password");
      return;
    }

    const key = generateKey(password);
    
    if (hasExistingDocs) {
      const docs = await getDocuments(key);
      if (docs === null) {
        setError("Incorrect password");
        return;
      }
      setDocuments(docs);
    }
    
    setCryptoKey(key);
    setIsAuthenticated(true);
  };

  const handleLockVault = () => {
    setIsAuthenticated(false);
    setPassword("");
    setCryptoKey("");
    setDocuments([]);
    setViewingDoc(null);
  };

  const handleGoogleSignIn = async () => {
    try {
        await signInWithGoogle();
    } catch (e) {
        alert("Failed to sign in. In the preview environment you must open the app in a new tab to authenticate.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileStr = await fileToBase64(file);
        
        await saveDocument(
          fileStr,
          {
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
          },
          cryptoKey
        );
      }
      
      const newDocs = await getDocuments(cryptoKey);
      if (newDocs) {
        setDocuments(newDocs);
        setHasExistingDocs(true);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to encrypt and save document. File might be too large.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleView = async (doc: SecureDocument) => {
    try {
      const content = await getDocumentContent(doc.id, cryptoKey);
      if (content) {
        setViewingDoc({ doc, content });
      } else {
        alert("Could not decrypt document. It may be corrupted.");
      }
    } catch (e) {
      alert("Error decrypting document.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this document permanently?")) {
      await deleteDocument(id);
      const newDocs = await getDocuments(cryptoKey);
      setDocuments(newDocs || []);
      if (newDocs?.length === 0) {
        setHasExistingDocs(false);
      }
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (isAuthLoading) {
      return (
          <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
              <div className="text-emerald-500 animate-pulse">Loading securely...</div>
          </div>
      );
  }

  if (!currentUser) {
       return (
          <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl p-8 space-y-8 text-center">
                   <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 mb-2">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-semibold text-white tracking-tight">Secure Cloud Vault</h1>
                    <p className="text-neutral-400 mt-2 text-sm">
                        Store your personal documents encrypted. Only you hold the key.
                    </p>

                    <button
                        onClick={handleGoogleSignIn}
                        className="w-full bg-white hover:bg-neutral-100 text-black font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" fillRule="evenodd" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1.12-10H17a5.539 5.539 0 00-.236-1.571 5.922 5.922 0 00-1.89-2.737c-1.077-.91-2.483-1.424-4.004-1.424-1.543 0-2.92.518-3.992 1.455a5.57 5.57 0 00-1.899 2.766 5.862 5.862 0 000 3.018A5.57 5.57 0 006.878 16.27c1.071.937 2.45 1.455 3.992 1.455 1.558 0 2.929-.55 3.98-1.53.864-.805 1.442-1.884 1.637-3.13h-5.607v-1.065z"></path>
                        </svg>
                        Sign in with Google
                    </button>
              </div>
          </div>
       );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl p-8 space-y-6">
          <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-white overflow-hidden text-sm uppercase">
                      {currentUser.photoURL ? <img src={currentUser.photoURL} alt="User" /> : currentUser.email?.charAt(0)}
                  </div>
                  <div>
                      <p className="text-white font-medium text-sm">{currentUser.displayName || "User"}</p>
                      <p className="text-neutral-500 text-xs">{currentUser.email}</p>
                  </div>
              </div>
              <button 
                  onClick={signOutUser}
                  className="text-xs text-neutral-500 hover:text-white transition-colors underline"
              >
                  Sign Out
              </button>
          </div>

          <div className="border-t border-neutral-800 pt-6">
              <h2 className="text-xl font-semibold text-white tracking-tight text-center mb-1">Unlock your Vault</h2>
              <p className="text-neutral-400 text-center text-sm mb-6">
                Your data is encrypted end-to-end. We cannot recover your password if you lose it.
              </p>

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-300">
                    {hasExistingDocs ? "Enter Vault Password" : "Create Vault Password"}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    required
                  />
                  {!hasExistingDocs && (
                      <p className="text-xs text-amber-500/80 flex items-center gap-1 mt-2">
                          <AlertCircle size={14} />
                          Write this password down securely.
                      </p>
                  )}
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  {hasExistingDocs ? "Decrypt & Unlock" : "Set Password & Initialize Vault"}
                </button>
              </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-neutral-900/50 p-6 rounded-2xl border border-neutral-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Secure Cloud Vault</h1>
              <p className="text-sm text-neutral-400">Encrypted on your device, stored in the cloud.</p>
            </div>
          </div>
          <button
            onClick={handleLockVault}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
          >
            <Lock size={16} />
            Lock Vault
          </button>
        </header>

        {/* Upload Zone */}
        <div className="relative group">
            <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={isUploading}
            />
            <div className={cn(
                "border-2 border-dashed border-neutral-800 rounded-3xl p-12 text-center transition-all duration-300",
                "bg-neutral-900/20 group-hover:bg-neutral-900/50 group-hover:border-emerald-500/30",
                isUploading && "opacity-50 pointer-events-none"
            )}>
               <div className="mx-auto w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-emerald-400 group-hover:scale-110 transition-all duration-300 mb-6">
                    <Upload size={28} />
               </div>
               <h3 className="text-lg font-medium text-white mb-2">
                   {isUploading ? "Encrypting and uploading securely..." : "Click or drag files to encrypt & store"}
               </h3>
               <p className="text-neutral-500 text-sm max-w-sm mx-auto">
                   Your files are encrypted locally. The server only sees locked data.
               </p>
            </div>
        </div>

        {/* Document List */}
        <div>
          <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FileText size={20} className="text-emerald-500" />
                  Your Documents
              </h2>
              <span className="text-sm text-neutral-500 bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800">
                  {documents.length} items
              </span>
          </div>

          {documents.length === 0 ? (
            <div className="text-center p-12 bg-neutral-900/30 border border-neutral-800/50 rounded-2xl">
                <p className="text-neutral-500">No documents in the vault yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="group bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 transition-all outline outline-0 focus-within:outline-2 focus-within:outline-emerald-500">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2.5 bg-neutral-800 text-emerald-400 rounded-lg shrink-0">
                            <FileText size={20} />
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-sm font-medium text-white truncate" title={doc.name}>{doc.name}</h4>
                            <p className="text-xs text-neutral-500 mt-1">{formatSize(doc.size)} • {new Date(doc.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                  </div>
                  
                  <div className="mt-5 flex items-center gap-2 pt-4 border-t border-neutral-800/50">
                    <button
                      onClick={() => handleView(doc)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-sm font-medium transition-colors"
                    >
                      <Eye size={16} />
                      Decrypt Request
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors shrink-0"
                      title="Permanently Delete from Server"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Viewing Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 w-full max-w-4xl h-[90vh] rounded-3xl border border-neutral-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 px-6 border-b border-neutral-800 bg-neutral-900/50 shrink-0">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                      <Lock size={16} />
                  </div>
                  <div className="max-w-[150px] sm:max-w-md">
                    <h3 className="text-white font-medium truncate" title={viewingDoc.doc.name}>
                        {viewingDoc.doc.name}
                    </h3>
                    <p className="text-xs text-emerald-500 font-mono">Decrypted locally</p>
                  </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={viewingDoc.content}
                  download={viewingDoc.doc.name}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4 sm:p-8 bg-neutral-950 flex items-center justify-center">
              {viewingDoc.doc.type.startsWith("image/") ? (
                <img
                  src={viewingDoc.content}
                  alt={viewingDoc.doc.name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : viewingDoc.doc.type === "application/pdf" ? (
                <iframe
                  src={viewingDoc.content}
                  className="w-full h-full rounded-lg bg-white"
                  title={viewingDoc.doc.name}
                />
              ) : (
                <div className="text-center max-w-md p-8 border border-neutral-800 rounded-2xl bg-neutral-900">
                  <div className="mx-auto w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center text-neutral-400 mb-4">
                      <FileText size={32} />
                  </div>
                  <p className="text-neutral-300 mb-6">Preview not available for this file type.</p>
                  <a
                    href={viewingDoc.content}
                    download={viewingDoc.doc.name}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    <Download size={18} />
                    Download to View
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

