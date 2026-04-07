// Client-side encryption utilities using Web Crypto API
// Zero-knowledge architecture: server never sees plaintext

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const ITERATIONS = 600000; // PBKDF2 iterations

// Derive encryption key from user password
export async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// Generate random salt
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

// Generate random IV for encryption
export function generateIV() {
  return crypto.getRandomValues(new Uint8Array(12));
}

// Encrypt text content
export async function encryptContent(plaintext, key) {
  const encoder = new TextEncoder();
  const iv = generateIV();
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine IV + ciphertext for storage
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  // Return as base64 for JSON storage
  return btoa(String.fromCharCode(...combined));
}

// Decrypt content
export async function decryptContent(encryptedBase64, key) {
  try {
    const combined = new Uint8Array(
      atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
    );
    
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

// Store encryption salt in localStorage (per-user)
export function storeSalt(userId, salt) {
  const saltBase64 = btoa(String.fromCharCode(...salt));
  localStorage.setItem(`oj_salt_${userId}`, saltBase64);
}

// Retrieve encryption salt
export function getSalt(userId) {
  const saltBase64 = localStorage.getItem(`oj_salt_${userId}`);
  if (!saltBase64) return null;
  return new Uint8Array(atob(saltBase64).split('').map(c => c.charCodeAt(0)));
}

// Initialize encryption for a user (call on registration or first login)
export async function initializeEncryption(userId, password) {
  let salt = getSalt(userId);
  
  if (!salt) {
    salt = generateSalt();
    storeSalt(userId, salt);
  }
  
  const key = await deriveKey(password, salt);
  
  // Store key in memory (sessionStorage for tab-scoped persistence)
  // In production, consider more secure key management
  sessionStorage.setItem('oj_encryption_ready', 'true');
  
  return key;
}

// Check if encryption is enabled
export function isEncryptionEnabled() {
  return localStorage.getItem('oj_encryption_enabled') === 'true';
}

// Enable/disable encryption
export function setEncryptionEnabled(enabled) {
  localStorage.setItem('oj_encryption_enabled', enabled ? 'true' : 'false');
}

// Export for use in entry creation/viewing
export default {
  deriveKey,
  generateSalt,
  encryptContent,
  decryptContent,
  initializeEncryption,
  isEncryptionEnabled,
  setEncryptionEnabled,
  getSalt,
  storeSalt
};
