//! Fuzz testing and boundary verification for nexus-proto codecs

use bytes::Bytes;
use nexus_proto::{NexusFrame, PacketHeader, PacketType, ProtoError, HEADER_SIZE};

#[test]
fn test_fuzz_random_bytes_decode() {
    // Generate pseudo-random buffers of various lengths and confirm no panic/crash occurs
    let mut state: u64 = 0x123456789ABCDEF0;
    for len in 0..1024 {
        let mut buf = vec![0u8; len];
        for b in buf.iter_mut() {
            state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            *b = (state >> 32) as u8;
        }

        let _ = PacketHeader::decode(&buf);
        let _ = NexusFrame::decode(Bytes::from(buf));
    }
}

#[test]
fn test_fuzz_header_mutations() {
    let base_hdr = PacketHeader::new(PacketType::Data, 1, 0x1234, 100);
    let mut encoded = [0u8; HEADER_SIZE];
    base_hdr.encode(&mut encoded).unwrap();

    // Flip every single bit in the header
    for byte_idx in 0..HEADER_SIZE {
        for bit_idx in 0..8 {
            let mut corrupted = encoded;
            corrupted[byte_idx] ^= 1 << bit_idx;

            let result = PacketHeader::decode(&corrupted);
            if byte_idx < 4 {
                // Magic corrupted
                assert!(matches!(result, Err(ProtoError::InvalidMagic(_))));
            } else if byte_idx == 4 {
                // Version corrupted
                assert!(matches!(result, Err(ProtoError::UnsupportedVersion(_))));
            } else if byte_idx == 5 {
                // Packet type corrupted
                if let Err(e) = result {
                    assert!(matches!(e, ProtoError::InvalidPacketType(_)));
                }
            }
        }
    }
}
