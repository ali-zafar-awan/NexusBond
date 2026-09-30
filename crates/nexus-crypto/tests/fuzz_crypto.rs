//! Fuzz testing and stress verification for nexus-crypto

use nexus_crypto::{CryptoError, ReplayWindow, SessionCipher, KEY_SIZE};

#[test]
fn test_fuzz_anti_replay_random_sequence() {
    let mut window = ReplayWindow::new();
    let mut rng: u64 = 0xCAFEBABEDEADBEEF;

    let mut seen = std::collections::HashSet::new();

    for _ in 0..10_000 {
        rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1);
        let seq = (rng % 500) + 1;

        let res = window.check_and_update(seq);
        if seen.contains(&seq) {
            assert!(matches!(res, Err(CryptoError::ReplayDetected(_))));
        } else if seq > 128 && seen.iter().max().copied().unwrap_or(0) > seq + 128 {
            // Far behind max
            assert!(matches!(res, Err(CryptoError::ReplayDetected(_))));
        } else {
            if res.is_ok() {
                seen.insert(seq);
            }
        }
    }
}

#[test]
fn test_fuzz_tampered_payloads() {
    let key = [0x77u8; KEY_SIZE];
    let mut sender = SessionCipher::new(&key, 0x12345678);
    let mut receiver = SessionCipher::new(&key, 0x12345678);

    let plaintext = b"Sensitive packet payload requiring ChaCha20-Poly1305 integrity";
    let (seq, ciphertext) = sender.encrypt(b"AAD", plaintext).unwrap();

    // Mutate every single byte of the ciphertext and ensure none decrypts
    for idx in 0..ciphertext.len() {
        let mut tampered = ciphertext.clone();
        tampered[idx] ^= 0x01;

        let res = receiver.decrypt(seq, b"AAD", &tampered);
        assert!(matches!(res, Err(CryptoError::DecryptionFailed)));
    }
}
