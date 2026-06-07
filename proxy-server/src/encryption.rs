//! Key derivation for HMAC operations
//!
//! Uses scrypt to derive a 32-byte key from the encryption password.
//! Compatible with TypeScript implementation in ai_chatbot/lib/encryption.ts

use scrypt::scrypt;
use thiserror::Error;

const ENCRYPTION_SALT: &[u8] = b"server-encryption-salt";
const KEY_LENGTH: usize = 32;

const SCRYPT_N: u8 = 14;
const SCRYPT_R: u32 = 8;
const SCRYPT_P: u32 = 1;

#[derive(Error, Debug)]
pub enum EncryptionError {
    #[error("Failed to derive key: {0}")]
    KeyDerivation(String),
}

pub type Result<T> = std::result::Result<T, EncryptionError>;

pub fn derive_key(password: &str) -> Result<[u8; KEY_LENGTH]> {
    let mut key = [0u8; KEY_LENGTH];
    scrypt(
        password.as_bytes(),
        ENCRYPTION_SALT,
        &scrypt::Params::new(SCRYPT_N, SCRYPT_R, SCRYPT_P, KEY_LENGTH).unwrap(),
        &mut key,
    )
    .map_err(|e: scrypt::errors::InvalidOutputLen| EncryptionError::KeyDerivation(e.to_string()))?;
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    const TEST_KEY: &str = "f302fec3004fd0c9e9946e15b309fea1b8b024cb04d93db9801d30c84c6e0508";

    #[test]
    fn test_derive_key_deterministic() {
        let key1 = derive_key(TEST_KEY).unwrap();
        let key2 = derive_key(TEST_KEY).unwrap();
        assert_eq!(key1, key2);

        let key3 = derive_key("different-password").unwrap();
        assert_ne!(key1, key3);
    }

    #[test]
    fn test_derive_key_length() {
        let key = derive_key(TEST_KEY).unwrap();
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn test_hmac_deterministic() {
        let key = derive_key(TEST_KEY).unwrap();
        let token = "sm-testtoken12345678901234567890123456789012345678901234567890";

        let mut mac1 = Hmac::<Sha256>::new_from_slice(&key).unwrap();
        mac1.update(token.as_bytes());
        let hash1 = hex::encode(mac1.finalize().into_bytes());

        let mut mac2 = Hmac::<Sha256>::new_from_slice(&key).unwrap();
        mac2.update(token.as_bytes());
        let hash2 = hex::encode(mac2.finalize().into_bytes());

        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64);
    }

    #[test]
    fn test_hmac_different_tokens() {
        let key = derive_key(TEST_KEY).unwrap();
        let token1 = "sm-token1";
        let token2 = "sm-token2";

        let mut mac1 = Hmac::<Sha256>::new_from_slice(&key).unwrap();
        mac1.update(token1.as_bytes());
        let hash1 = hex::encode(mac1.finalize().into_bytes());

        let mut mac2 = Hmac::<Sha256>::new_from_slice(&key).unwrap();
        mac2.update(token2.as_bytes());
        let hash2 = hex::encode(mac2.finalize().into_bytes());

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_hmac_different_keys() {
        let key1 = derive_key("password1").unwrap();
        let key2 = derive_key("password2").unwrap();
        let token = "sm-testtoken";

        let mut mac1 = Hmac::<Sha256>::new_from_slice(&key1).unwrap();
        mac1.update(token.as_bytes());
        let hash1 = hex::encode(mac1.finalize().into_bytes());

        let mut mac2 = Hmac::<Sha256>::new_from_slice(&key2).unwrap();
        mac2.update(token.as_bytes());
        let hash2 = hex::encode(mac2.finalize().into_bytes());

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_hmac_format() {
        let key = derive_key(TEST_KEY).unwrap();
        let token = "sm-testtoken12345678901234567890123456789012345678901234567890";

        let mut mac = Hmac::<Sha256>::new_from_slice(&key).unwrap();
        mac.update(token.as_bytes());
        let hash = hex::encode(mac.finalize().into_bytes());

        assert_eq!(hash.len(), 64);
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
    }
}
