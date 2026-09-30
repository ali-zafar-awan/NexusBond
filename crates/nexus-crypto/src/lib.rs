//! NexusBond Cryptographic Engine (nexus-crypto)
//! Implements Noise_IK authenticated key exchange, ChaCha20-Poly1305 AEAD,
//! 128-packet sliding replay protection, and session rekeying according to SRS v2.0 Section 5.

use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
use snow::params::NoiseParams;
use snow::{Builder, HandshakeState, TransportState};
use thiserror::Error;

/// Noise Protocol Pattern: Noise_IK_25519_ChaChaPoly_BLAKE2s
pub const NOISE_PATTERN: &str = "Noise_IK_25519_ChaChaPoly_BLAKE2s";
pub const KEY_SIZE: usize = 32;
pub const TAG_SIZE: usize = 16;
pub const NONCE_SIZE: usize = 12;

/// Rekey trigger limits per SRS Section 5.3
pub const REKEY_TIME_SECS: u64 = 7200; // 2 hours
pub const REKEY_BYTES_LIMIT: u64 = 100 * 1024 * 1024 * 1024; // 100 GB

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Noise handshake error: {0}")]
    NoiseHandshake(#[from] snow::Error),
    #[error("AEAD encryption error: {0}")]
    Encryption(String),
    #[error("AEAD decryption failure or authentication tag mismatch")]
    DecryptionFailed,
    #[error("Replay packet detected: sequence {0} already seen or outside window")]
    ReplayDetected(u64),
    #[error("Session not initialized")]
    UninitializedSession,
}

/// Anti-replay sliding window (128-bit bitmap tracking last 128 packets)
/// Adheres to RFC 4303 / WireGuard anti-replay verification semantics.
#[derive(Debug, Clone)]
pub struct ReplayWindow {
    max_seq: u64,
    bitmap: u128,
}

impl Default for ReplayWindow {
    fn default() -> Self {
        Self::new()
    }
}

impl ReplayWindow {
    pub const WINDOW_SIZE: u64 = 128;

    pub fn new() -> Self {
        Self {
            max_seq: 0,
            bitmap: 0,
        }
    }

    /// Check if sequence is acceptable without mutating bitmap.
    pub fn check(&self, seq: u64) -> Result<(), CryptoError> {
        if seq == 0 && self.max_seq == 0 && self.bitmap == 0 {
            return Ok(());
        }
        if seq > self.max_seq {
            Ok(())
        } else {
            let diff = self.max_seq - seq;
            if diff >= Self::WINDOW_SIZE {
                return Err(CryptoError::ReplayDetected(seq));
            }
            let bit = 1u128 << diff;
            if (self.bitmap & bit) != 0 {
                return Err(CryptoError::ReplayDetected(seq));
            }
            Ok(())
        }
    }

    /// Mark sequence as seen after MAC authentication passes.
    pub fn mark_seen(&mut self, seq: u64) {
        if seq > self.max_seq {
            let diff = seq - self.max_seq;
            if diff >= Self::WINDOW_SIZE {
                self.bitmap = 1;
            } else {
                self.bitmap <<= diff;
                self.bitmap |= 1;
            }
            self.max_seq = seq;
        } else {
            let diff = self.max_seq - seq;
            if diff < Self::WINDOW_SIZE {
                let bit = 1u128 << diff;
                self.bitmap |= bit;
            }
        }
    }

    /// Convenience check and update.
    pub fn check_and_update(&mut self, seq: u64) -> Result<(), CryptoError> {
        self.check(seq)?;
        self.mark_seen(seq);
        Ok(())
    }
}

/// ChaCha20-Poly1305 Session Cipher for Data Planes
pub struct SessionCipher {
    cipher: ChaCha20Poly1305,
    session_id: u32,
    tx_counter: u64,
    rx_replay_window: ReplayWindow,
    bytes_transferred: u64,
}

impl SessionCipher {
    pub fn new(key: &[u8; KEY_SIZE], session_id: u32) -> Self {
        let key_ref = Key::from_slice(key);
        let cipher = ChaCha20Poly1305::new(key_ref);
        Self {
            cipher,
            session_id,
            tx_counter: 0,
            rx_replay_window: ReplayWindow::new(),
            bytes_transferred: 0,
        }
    }

    /// Build 12-byte Nonce: [ SessionID (4B) | Packet Sequence Counter (8B) ]
    fn build_nonce(session_id: u32, seq: u64) -> Nonce {
        let mut nonce_bytes = [0u8; NONCE_SIZE];
        nonce_bytes[0..4].copy_from_slice(&session_id.to_be_bytes());
        nonce_bytes[4..12].copy_from_slice(&seq.to_be_bytes());
        *Nonce::from_slice(&nonce_bytes)
    }

    /// Encrypt plaintext with associated data (AAD) using ChaCha20-Poly1305.
    pub fn encrypt(&mut self, aad: &[u8], plaintext: &[u8]) -> Result<(u64, Vec<u8>), CryptoError> {
        let seq = self.tx_counter;
        self.tx_counter += 1;
        self.bytes_transferred += plaintext.len() as u64;

        let nonce = Self::build_nonce(self.session_id, seq);
        let payload = Payload {
            msg: plaintext,
            aad,
        };

        let ciphertext = self
            .cipher
            .encrypt(&nonce, payload)
            .map_err(|e| CryptoError::Encryption(e.to_string()))?;

        Ok((seq, ciphertext))
    }

    /// Decrypt ciphertext with associated data (AAD) and verify anti-replay window.
    pub fn decrypt(&mut self, seq: u64, aad: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, CryptoError> {
        // 1. Verify sequence not already seen before expensive MAC check
        self.rx_replay_window.check(seq)?;

        let nonce = Self::build_nonce(self.session_id, seq);
        let payload = Payload {
            msg: ciphertext,
            aad,
        };

        // 2. Authenticated decryption
        let plaintext = self
            .cipher
            .decrypt(&nonce, payload)
            .map_err(|_| CryptoError::DecryptionFailed)?;

        // 3. Mark sequence as permanently received only after MAC passes
        self.rx_replay_window.mark_seen(seq);
        self.bytes_transferred += plaintext.len() as u64;
        Ok(plaintext)
    }

    pub fn should_rekey(&self, elapsed_secs: u64) -> bool {
        elapsed_secs >= REKEY_TIME_SECS || self.bytes_transferred >= REKEY_BYTES_LIMIT
    }
}

/// Noise_IK Handshake Helper for Client & Server
pub struct NoiseHandshake {
    state: HandshakeState,
    pub is_initiator: bool,
}

impl NoiseHandshake {
    pub fn new_initiator(client_static_priv: &[u8], server_static_pub: &[u8]) -> Result<Self, CryptoError> {
        let params: NoiseParams = NOISE_PATTERN.parse().map_err(CryptoError::NoiseHandshake)?;
        let builder = Builder::new(params);
        let state = builder
            .local_private_key(client_static_priv)
            .remote_public_key(server_static_pub)
            .build_initiator()
            .map_err(CryptoError::NoiseHandshake)?;

        Ok(Self {
            state,
            is_initiator: true,
        })
    }

    pub fn new_responder(server_static_priv: &[u8]) -> Result<Self, CryptoError> {
        let params: NoiseParams = NOISE_PATTERN.parse().map_err(CryptoError::NoiseHandshake)?;
        let builder = Builder::new(params);
        let state = builder
            .local_private_key(server_static_priv)
            .build_responder()
            .map_err(CryptoError::NoiseHandshake)?;

        Ok(Self {
            state,
            is_initiator: false,
        })
    }

    pub fn write_message(&mut self, payload: &[u8], message_out: &mut [u8]) -> Result<usize, CryptoError> {
        let len = self
            .state
            .write_message(payload, message_out)
            .map_err(CryptoError::NoiseHandshake)?;
        Ok(len)
    }

    pub fn read_message(&mut self, message_in: &[u8], payload_out: &mut [u8]) -> Result<usize, CryptoError> {
        let len = self
            .state
            .read_message(message_in, payload_out)
            .map_err(CryptoError::NoiseHandshake)?;
        Ok(len)
    }

    pub fn is_handshake_finished(&self) -> bool {
        self.state.is_handshake_finished()
    }

    pub fn into_transport(self) -> Result<TransportState, CryptoError> {
        self.state
            .into_transport_mode()
            .map_err(CryptoError::NoiseHandshake)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_cipher_encrypt_decrypt_roundtrip() {
        let key = [0x42u8; KEY_SIZE];
        let session_id = 0x99887766;
        let mut sender = SessionCipher::new(&key, session_id);
        let mut receiver = SessionCipher::new(&key, session_id);

        let aad = b"NexusBond Header Data";
        let plaintext = b"Hello, secure bonded network tunnel!";

        let (seq, ciphertext) = sender.encrypt(aad, plaintext).unwrap();
        assert_ne!(plaintext.to_vec(), ciphertext);

        let decrypted = receiver.decrypt(seq, aad, &ciphertext).unwrap();
        assert_eq!(plaintext.to_vec(), decrypted);
    }

    #[test]
    fn test_session_cipher_reject_tampered_ciphertext() {
        let key = [0x55u8; KEY_SIZE];
        let session_id = 0x11223344;
        let mut sender = SessionCipher::new(&key, session_id);
        let mut receiver = SessionCipher::new(&key, session_id);

        let aad = b"Header";
        let (seq, mut ciphertext) = sender.encrypt(aad, b"Secret").unwrap();
        ciphertext[0] ^= 0xFF;

        let res = receiver.decrypt(seq, aad, &ciphertext);
        assert!(matches!(res, Err(CryptoError::DecryptionFailed)));
    }

    #[test]
    fn test_noise_ik_full_handshake_exchange() {
        let builder = Builder::new(NOISE_PATTERN.parse().unwrap());
        let client_keys = builder.generate_keypair().unwrap();
        let server_keys = builder.generate_keypair().unwrap();

        let mut client = NoiseHandshake::new_initiator(&client_keys.private, &server_keys.public).unwrap();
        let mut server = NoiseHandshake::new_responder(&server_keys.private).unwrap();

        let mut msg1 = [0u8; 128];
        let len1 = client.write_message(b"ClientHello", &mut msg1).unwrap();

        let mut s_payload = [0u8; 128];
        let s_len = server.read_message(&msg1[..len1], &mut s_payload).unwrap();
        assert_eq!(&s_payload[..s_len], b"ClientHello");

        let mut msg2 = [0u8; 128];
        let len2 = server.write_message(b"ServerReady", &mut msg2).unwrap();

        let mut c_payload = [0u8; 128];
        let c_len = client.read_message(&msg2[..len2], &mut c_payload).unwrap();
        assert_eq!(&c_payload[..c_len], b"ServerReady");

        assert!(client.is_handshake_finished());
        assert!(server.is_handshake_finished());

        let mut client_transport = client.into_transport().unwrap();
        let mut server_transport = server.into_transport().unwrap();

        let mut secure_buf = [0u8; 256];
        let enc_len = client_transport.write_message(b"Multipath Encrypted Stream", &mut secure_buf).unwrap();

        let mut dec_buf = [0u8; 256];
        let dec_len = server_transport.read_message(&secure_buf[..enc_len], &mut dec_buf).unwrap();
        assert_eq!(&dec_buf[..dec_len], b"Multipath Encrypted Stream");
    }
}
