import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

export async function hashPassword(password: string, salt = crypto.randomBytes(16)) {
  const hash = await scrypt(password, salt)
  return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [, saltValue, hashValue] = encodedHash.split(':')
  if (!saltValue || !hashValue) return false

  const salt = Buffer.from(saltValue, 'base64')
  const expected = Buffer.from(hashValue, 'base64')
  const actual = await scrypt(password, salt)

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('base64url')
}

export function encryptSecret(value: string) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.')
}

export function decryptSecret(value: string) {
  const key = getEncryptionKey()
  const [ivValue, tagValue, ciphertextValue] = value.split('.')
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Invalid encrypted setting.')
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivValue, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

function getEncryptionKey() {
  const secret = process.env.APP_ENCRYPTION_KEY ?? process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('APP_ENCRYPTION_KEY or SESSION_SECRET is required.')
  }

  return crypto.createHash('sha256').update(secret).digest()
}

function scrypt(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}
