//! NexusBond Cryptographic Engine (nexus-crypto)
//! Provides Noise_IK pattern session establishment, ChaCha20-Poly1305 AEAD, and replay protection.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Handshake error: {0}")]
    Handshake(String),
    #[error("Encryption failure: {0}")]
    Encryption(String),
    #[error("Decryption failure / MAC mismatch: {0}")]
    Decryption(String),
    #[error("Replay packet detected: sequence {0} already seen or outside window")]
    ReplayDetected(u64),
}

/// Anti-replay sliding window (64/128 packets)
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

    /// Check and record sequence number. Returns Ok(()) if valid and not seen.
    pub fn check_and_update(&mut self, seq: u64) -> Result<(), CryptoError> {
        if seq > self.max_seq {
            let diff = seq - self.max_seq;
            if diff >= Self::WINDOW_SIZE {
                self.bitmap = 1;
            } else {
                self.bitmap <<= diff;
                self.bitmap |= 1;
            }
            self.max_seq = seq;
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
            self.bitmap |= bit;
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_replay_window_in_order() {
        let mut w = ReplayWindow::new();
        assert!(w.check_and_update(1).is_ok());
        assert!(w.check_and_update(2).is_ok());
        assert!(w.check_and_update(3).is_ok());
    }

    #[test]
    fn test_replay_window_reject_duplicate() {
        let mut w = ReplayWindow::new();
        assert!(w.check_and_update(5).is_ok());
        assert!(w.check_and_update(5).is_err());
    }

    #[test]
    fn test_replay_window_out_of_order() {
        let mut w = ReplayWindow::new();
        assert!(w.check_and_update(10).is_ok());
        assert!(w.check_and_update(8).is_ok());
        assert!(w.check_and_update(9).is_ok());
        assert!(w.check_and_update(8).is_err());
    }
}
