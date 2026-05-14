import CryptoJS from 'crypto-js';

// Derive a key from the password to use for encryption
export function generateKey(password: string): string {
    return CryptoJS.SHA256(password).toString(CryptoJS.enc.Hex);
}

// Encrypt string data
export function encryptData(data: string, key: string): string {
    return CryptoJS.AES.encrypt(data, key).toString();
}

// Decrypt string data
export function decryptData(encryptedData: string, key: string): string | null {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, key);
        const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
        if (!decryptedStr) return null;
        return decryptedStr;
    } catch (e) {
        return null;
    }
}

// Convert a File to Base64
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
}
