import { encryptData, decryptData } from './lib/encryption';
import { db, auth } from './lib/firebase';
import { 
    collection, doc, setDoc, getDocs, deleteDoc,
    query, orderBy, serverTimestamp, writeBatch 
} from 'firebase/firestore';

export interface SecureDocument {
    id: string;
    name: string;
    type: string;
    size: number;
    createdAt: number;
    encryptionCheck: string;
    userId: string;
}

const CHUNK_SIZE = 800 * 1024; // 800 KB

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function chunkString(str: string, size: number): string[] {
    const numChunks = Math.ceil(str.length / size);
    const chunks = new Array(numChunks);
    for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
        chunks[i] = str.substring(o, o + size);
    }
    return chunks;
}

export async function saveDocument(
    fileStr: string,
    metadata: Omit<SecureDocument, 'id' | 'createdAt' | 'encryptionCheck' | 'userId'>,
    key: string
) {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Must be logged in to save documents");

    const id = crypto.randomUUID();
    const encryptionCheck = encryptData('VALID_KEY', key);

    const docRef = doc(db, 'users', userId, 'documents', id);
    
    // Encrypt the file content
    const encryptedFile = encryptData(fileStr, key);
    
    const chunks = chunkString(encryptedFile, CHUNK_SIZE);
    
    const batch = writeBatch(db);

    // Save metadata
    batch.set(docRef, {
        userId,
        name: metadata.name,
        type: metadata.type,
        size: metadata.size,
        encryptionCheck,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Save chunks
    for (let i = 0; i < chunks.length; i++) {
        const chunkId = crypto.randomUUID();
        const chunkRef = doc(db, 'users', userId, 'documents', id, 'chunks', chunkId);
        batch.set(chunkRef, {
            userId,
            data: chunks[i],
            index: i,
            createdAt: serverTimestamp()
        });
    }

    try {
        await batch.commit();
        return {
            ...metadata,
            id,
            createdAt: Date.now(),
            encryptionCheck,
            userId
        } as SecureDocument;
    } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, docRef.path);
    }
}

export async function getDocuments(key: string): Promise<SecureDocument[] | null> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Must be logged in to load documents");

    const documentsRef = collection(db, 'users', userId, 'documents');
    const q = query(documentsRef, orderBy('createdAt', 'desc'));
    
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return [];

        const docs = querySnapshot.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                name: data.name,
                type: data.type,
                size: data.size,
                createdAt: data.createdAt?.toMillis() || Date.now(),
                encryptionCheck: data.encryptionCheck,
                userId: data.userId
            } as SecureDocument;
        });

        // Verify key with the first document
        const testDoc = docs[0];
        const check = decryptData(testDoc.encryptionCheck, key);

        if (check !== 'VALID_KEY') {
            return null; // Invalid password
        }

        return docs;
    } catch (e) {
        handleFirestoreError(e, OperationType.LIST, documentsRef.path);
        return null;
    }
}

export async function checkHasDocuments(): Promise<boolean> {
     const userId = auth.currentUser?.uid;
     if (!userId) return false;

     const documentsRef = collection(db, 'users', userId, 'documents');
     try {
         const snap = await getDocs(documentsRef);
         return !snap.empty;
     } catch (e) {
         handleFirestoreError(e, OperationType.LIST, documentsRef.path);
         return false;
     }
}

export async function getDocumentContent(id: string, key: string): Promise<string | null> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Must be logged in to get document content");

    const chunksRef = collection(db, 'users', userId, 'documents', id, 'chunks');
    const q = query(chunksRef, orderBy('index', 'asc'));

    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return null;

        const encryptedFile = querySnapshot.docs.map(d => d.data().data).join('');
        return decryptData(encryptedFile, key);
    } catch (e) {
        handleFirestoreError(e, OperationType.GET, chunksRef.path);
        return null; // unreachable due to throw
    }
}

export async function deleteDocument(id: string) {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("Must be logged in to delete document");

    const docRef = doc(db, 'users', userId, 'documents', id);
    const chunksRef = collection(db, 'users', userId, 'documents', id, 'chunks');
    
    try {
        // Find all chunks and delete them
        const snap = await getDocs(chunksRef);
        const batch = writeBatch(db);
        snap.docs.forEach(d => {
            batch.delete(d.ref);
        });
        batch.delete(docRef);
        
        await batch.commit();
    } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, docRef.path);
    }
}
