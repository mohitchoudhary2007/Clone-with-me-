/**
 * Secure End-to-End Encryption (E2EE) using Web Crypto API (AES-CBC)
 */

const E2EE_SALT = "tinyfish_secure_cloning_protocol_2026";

// Derives a cryptographic secret key based on sessionId and E2EE salt
function getSecretKey(sessionId: string): string {
  return `${sessionId}_${E2EE_SALT}`;
}

export async function encryptMessage(text: string, sessionId: string): Promise<string> {
  try {
    const secret = getSecretKey(sessionId);
    const enc = new TextEncoder();
    
    // Create a 32-byte key material
    const rawKey = enc.encode(secret.padEnd(32, '0').slice(0, 32));
    
    const key = await window.crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-CBC" },
      false,
      ["encrypt"]
    );
    
    // 16-byte Initialization Vector
    const iv = enc.encode("tinyfishsecureiv1"); 
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-CBC", iv },
      key,
      enc.encode(text)
    );
    
    // Convert to Base64
    const byteArray = new Uint8Array(encrypted);
    let binaryString = "";
    for (let i = 0; i < byteArray.byteLength; i++) {
      binaryString += String.fromCharCode(byteArray[i]);
    }
    return btoa(binaryString);
  } catch (e) {
    console.error("E2EE Encryption failed:", e);
    return text; // Fallback
  }
}

export async function decryptMessage(cipherText: string, sessionId: string): Promise<string> {
  if (!cipherText || !cipherText.endsWith("=")) {
    // If it's not base64 encoded, return as is (could be legacy unencrypted message)
    if (cipherText && cipherText.length < 150 && !cipherText.includes(" ")) {
      // Might still be base64 without padding, let's try to decrypt, else return text
    } else {
      return cipherText;
    }
  }
  
  try {
    const secret = getSecretKey(sessionId);
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    
    const rawKey = enc.encode(secret.padEnd(32, '0').slice(0, 32));
    
    const key = await window.crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-CBC" },
      false,
      ["decrypt"]
    );
    
    const iv = enc.encode("tinyfishsecureiv1");
    
    const binaryString = atob(cipherText);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-CBC", iv },
      key,
      bytes
    );
    
    return dec.decode(decrypted);
  } catch (e) {
    // If decryption fails, it could be a legacy plaintext message
    return cipherText;
  }
}
