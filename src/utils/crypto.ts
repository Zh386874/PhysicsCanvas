/**
 * API Key 加密工具
 * 使用 Web Crypto API 的 AES-GCM 对 API Key 进行加密存储，
 * 防止 localStorage 中的密钥被明文窃取。
 *
 * 加密密钥由应用标识符派生，非持久化（每次页面加载时重新派生）。
 *
 * ⚠️ 局限说明（如实披露）：
 * 本加密为"混淆层"（obfuscation），而非对攻击者的强安全防护。
 * 加解密密钥派生自应用内固定参数（APP_SEED + 固定 SALT），任何能
 * 获取本应用源码/JS bundle 的人都能逆向解出密钥并解密 localStorage
 * 中的 Key。真正的安全边界在于：XSS 防护（本项目不使用 v-html，渲染
 * 均走 Vue 文本插值）+ 不在不可信设备/浏览器中输入或保存 Key。
 */

const APP_SEED = 'physics-sim-app-v1'
const SALT = new TextEncoder().encode('fixed-salt-for-key-derivation')

let cachedKey: CryptoKey | null = null

/** 派生 AES-GCM 密钥（PBKDF2） */
async function deriveKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(APP_SEED),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
  return cachedKey
}

/**
 * 加密明文
 * @returns base64 编码的密文（含 IV）
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await deriveKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  // 合并 IV + 密文
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

/**
 * 解密密文
 * @param combinedB64 base64 编码的密文（含 IV）
 * @returns 明文，解密失败返回 null
 */
export async function decrypt(combinedB64: string): Promise<string | null> {
  try {
    const key = await deriveKey()
    const combined = Uint8Array.from(atob(combinedB64), (c) => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(decrypted)
  } catch {
    return null
  }
}
