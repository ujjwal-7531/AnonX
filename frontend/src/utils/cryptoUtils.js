// Native Web Crypto API utilities for ECDH (P-256) + AES-GCM (256-bit) E2EE

// Base64 Helpers
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// In-Memory Key Caches
let cachedLocalKeyPair = null;
const derivedSharedKeyCache = new Map();

/**
 * Retrieves existing local ECDH P-256 keypair or generates a new one.
 * Returns { publicKeyBase64, privateKey }
 */
export async function getOrGenerateKeyPair() {
  if (cachedLocalKeyPair) {
    return cachedLocalKeyPair;
  }

  const storedPub = localStorage.getItem("anonx_ecdh_pub");
  const storedPriv = localStorage.getItem("anonx_ecdh_priv");

  if (storedPub && storedPriv) {
    try {
      const privBuffer = base64ToArrayBuffer(storedPriv);
      const privateKey = await window.crypto.subtle.importKey(
        "pkcs8",
        privBuffer,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
      );

      cachedLocalKeyPair = {
        publicKeyBase64: storedPub,
        privateKey
      };
      return cachedLocalKeyPair;
    } catch (err) {
      console.warn("Could not import stored keypair, generating fresh keypair:", err);
    }
  }

  // Generate new ECDH keypair
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );

  const exportedPub = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const exportedPriv = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  const publicKeyBase64 = arrayBufferToBase64(exportedPub);
  const privateKeyBase64 = arrayBufferToBase64(exportedPriv);

  localStorage.setItem("anonx_ecdh_pub", publicKeyBase64);
  localStorage.setItem("anonx_ecdh_priv", privateKeyBase64);

  cachedLocalKeyPair = {
    publicKeyBase64,
    privateKey: keyPair.privateKey
  };

  return cachedLocalKeyPair;
}

/**
 * Derives a 256-bit AES-GCM shared key from the local private key and peer's public key Base64.
 */
export async function deriveSharedKey(peerPublicKeyBase64) {
  if (!peerPublicKeyBase64) return null;
  if (derivedSharedKeyCache.has(peerPublicKeyBase64)) {
    return derivedSharedKeyCache.get(peerPublicKeyBase64);
  }

  try {
    const { privateKey } = await getOrGenerateKeyPair();
    const peerPubBuffer = base64ToArrayBuffer(peerPublicKeyBase64);

    const peerPublicKey = await window.crypto.subtle.importKey(
      "spki",
      peerPubBuffer,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );

    const sharedKey = await window.crypto.subtle.deriveKey(
      { name: "ECDH", public: peerPublicKey },
      privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    derivedSharedKeyCache.set(peerPublicKeyBase64, sharedKey);
    return sharedKey;
  } catch (err) {
    console.error("Failed to derive shared key:", err);
    return null;
  }
}

/**
 * Encrypts a plaintext message using AES-GCM 256-bit with a random 12-byte IV.
 * Returns { ciphertext, iv }
 */
export async function encryptMessage(plaintext, sharedKey) {
  if (!sharedKey) {
    throw new Error("Encryption key not available for this chat");
  }

  const encoder = new TextEncoder();
  const encodedText = encoder.encode(plaintext);

  // Generate random 12-byte IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    encodedText
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv.buffer)
  };
}

/**
 * Decrypts an AES-GCM ciphertext using the derived shared key and IV.
 */
export async function decryptMessage(ciphertext, iv, sharedKey) {
  if (!ciphertext) return "";
  if (!iv || !sharedKey) {
    return ciphertext; // Fallback for unencrypted legacy messages
  }

  try {
    const cipherBuffer = base64ToArrayBuffer(ciphertext);
    const ivBuffer = base64ToArrayBuffer(iv);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(ivBuffer) },
      sharedKey,
      cipherBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.warn("Message decryption failed (key mismatch or corrupt data):", err.message);
    return "[Encrypted Message - Key Unavailable]";
  }
}
