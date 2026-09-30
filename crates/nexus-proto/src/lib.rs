//! NexusBond Wire Protocol (nexus-proto)
//! Defines frame headers, packet codecs, ACK payloads, Probe frames, and serialization
//! strictly according to SRS v2.0 Section 5.

use bytes::{Buf, BufMut, Bytes, BytesMut};
use thiserror::Error;

/// Protocol magic header: 0x4E584244 ("NXBD")
pub const PROTOCOL_MAGIC: u32 = 0x4E584244;
pub const PROTOCOL_VERSION: u8 = 2;
pub const HEADER_SIZE: usize = 16;
pub const MAX_PACKET_SIZE: usize = 1450; // Under standard 1500 MTU to prevent IP fragmentation

#[derive(Error, Debug, PartialEq, Eq)]
pub enum ProtoError {
    #[error("Invalid magic bytes: expected 0x{PROTOCOL_MAGIC:08X}, got 0x{0:08X}")]
    InvalidMagic(u32),
    #[error("Unsupported protocol version: {0}")]
    UnsupportedVersion(u8),
    #[error("Buffer too short: needed {needed}, available {available}")]
    BufferTooShort { needed: usize, available: usize },
    #[error("Packet size exceeds MTU ({size} > {max})")]
    PacketTooLarge { size: usize, max: usize },
    #[error("Invalid packet type: 0x{0:02X}")]
    InvalidPacketType(u8),
    #[error("Corrupted payload: {0}")]
    CorruptedPayload(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum PacketType {
    HandshakeInit = 0x01,
    HandshakeResp = 0x02,
    Data = 0x03,
    Ack = 0x04,
    Probe = 0x05,
    ProbeResp = 0x06,
    Fec = 0x07,
    Rekey = 0x08,
    Close = 0x09,
}

impl TryFrom<u8> for PacketType {
    type Error = ProtoError;

    fn try_from(val: u8) -> Result<Self, Self::Error> {
        match val {
            0x01 => Ok(PacketType::HandshakeInit),
            0x02 => Ok(PacketType::HandshakeResp),
            0x03 => Ok(PacketType::Data),
            0x04 => Ok(PacketType::Ack),
            0x05 => Ok(PacketType::Probe),
            0x06 => Ok(PacketType::ProbeResp),
            0x07 => Ok(PacketType::Fec),
            0x08 => Ok(PacketType::Rekey),
            0x09 => Ok(PacketType::Close),
            other => Err(ProtoError::InvalidPacketType(other)),
        }
    }
}

/// Fixed 16-byte Packet Header
/// Layout:
/// - 0..4   : Magic (0x4E584244)
/// - 4      : Version (2)
/// - 5      : PacketType (0x01..0x09)
/// - 6      : LinkId (1..8)
/// - 7      : Flags (Bit 0: Urgent, Bit 1: Duplicate, Bit 2: FEC enabled)
/// - 8..12  : SessionID (u32)
/// - 12..16 : Sequence (u32)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PacketHeader {
    pub magic: u32,
    pub version: u8,
    pub packet_type: PacketType,
    pub link_id: u8,
    pub flags: u8,
    pub session_id: u32,
    pub sequence: u32,
}

impl PacketHeader {
    pub const FLAG_URGENT: u8 = 1 << 0;
    pub const FLAG_DUPLICATE: u8 = 1 << 1;
    pub const FLAG_FEC: u8 = 1 << 2;

    pub fn new(packet_type: PacketType, link_id: u8, session_id: u32, sequence: u32) -> Self {
        Self {
            magic: PROTOCOL_MAGIC,
            version: PROTOCOL_VERSION,
            packet_type,
            link_id,
            flags: 0,
            session_id,
            sequence,
        }
    }

    pub fn encode(&self, buf: &mut [u8]) -> Result<(), ProtoError> {
        if buf.len() < HEADER_SIZE {
            return Err(ProtoError::BufferTooShort {
                needed: HEADER_SIZE,
                available: buf.len(),
            });
        }
        buf[0..4].copy_from_slice(&self.magic.to_be_bytes());
        buf[4] = self.version;
        buf[5] = self.packet_type as u8;
        buf[6] = self.link_id;
        buf[7] = self.flags;
        buf[8..12].copy_from_slice(&self.session_id.to_be_bytes());
        buf[12..16].copy_from_slice(&self.sequence.to_be_bytes());
        Ok(())
    }

    pub fn decode(buf: &[u8]) -> Result<Self, ProtoError> {
        if buf.len() < HEADER_SIZE {
            return Err(ProtoError::BufferTooShort {
                needed: HEADER_SIZE,
                available: buf.len(),
            });
        }
        let magic = u32::from_be_bytes(buf[0..4].try_into().unwrap());
        if magic != PROTOCOL_MAGIC {
            return Err(ProtoError::InvalidMagic(magic));
        }
        let version = buf[4];
        if version != PROTOCOL_VERSION {
            return Err(ProtoError::UnsupportedVersion(version));
        }
        let packet_type = PacketType::try_from(buf[5])?;
        let link_id = buf[6];
        let flags = buf[7];
        let session_id = u32::from_be_bytes(buf[8..12].try_into().unwrap());
        let sequence = u32::from_be_bytes(buf[12..16].try_into().unwrap());

        Ok(Self {
            magic,
            version,
            packet_type,
            link_id,
            flags,
            session_id,
            sequence,
        })
    }
}

/// Acknowledge frame payload (Cumulative ACK + Selective ACK 64-bit bitmap)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AckPayload {
    pub cumulative_seq: u32,
    pub sack_bitmap: u64,
    pub rcv_timestamp_us: u64,
}

impl AckPayload {
    pub const SIZE: usize = 20;

    pub fn encode(&self, dst: &mut BytesMut) {
        dst.put_u32(self.cumulative_seq);
        dst.put_u64(self.sack_bitmap);
        dst.put_u64(self.rcv_timestamp_us);
    }

    pub fn decode(mut src: &[u8]) -> Result<Self, ProtoError> {
        if src.len() < Self::SIZE {
            return Err(ProtoError::BufferTooShort {
                needed: Self::SIZE,
                available: src.len(),
            });
        }
        let cumulative_seq = src.get_u32();
        let sack_bitmap = src.get_u64();
        let rcv_timestamp_us = src.get_u64();

        Ok(Self {
            cumulative_seq,
            sack_bitmap,
            rcv_timestamp_us,
        })
    }
}

/// Probe frame payload (RTT latency & packet loss telemetry)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProbePayload {
    pub send_timestamp_us: u64,
    pub echo_timestamp_us: u64,
    pub probe_id: u32,
}

impl ProbePayload {
    pub const SIZE: usize = 20;

    pub fn encode(&self, dst: &mut BytesMut) {
        dst.put_u64(self.send_timestamp_us);
        dst.put_u64(self.echo_timestamp_us);
        dst.put_u32(self.probe_id);
    }

    pub fn decode(mut src: &[u8]) -> Result<Self, ProtoError> {
        if src.len() < Self::SIZE {
            return Err(ProtoError::BufferTooShort {
                needed: Self::SIZE,
                available: src.len(),
            });
        }
        let send_timestamp_us = src.get_u64();
        let echo_timestamp_us = src.get_u64();
        let probe_id = src.get_u32();

        Ok(Self {
            send_timestamp_us,
            echo_timestamp_us,
            probe_id,
        })
    }
}

/// Complete NexusBond Frame Container
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NexusFrame {
    pub header: PacketHeader,
    pub payload: Bytes,
}

impl NexusFrame {
    pub fn new(header: PacketHeader, payload: Bytes) -> Self {
        Self { header, payload }
    }

    pub fn encode(&self) -> Result<Bytes, ProtoError> {
        let total_size = HEADER_SIZE + self.payload.len();
        if total_size > MAX_PACKET_SIZE {
            return Err(ProtoError::PacketTooLarge {
                size: total_size,
                max: MAX_PACKET_SIZE,
            });
        }
        let mut buf = BytesMut::with_capacity(total_size);
        buf.resize(HEADER_SIZE, 0);
        self.header.encode(&mut buf[0..HEADER_SIZE])?;
        buf.extend_from_slice(&self.payload);
        Ok(buf.freeze())
    }

    pub fn decode(mut raw: Bytes) -> Result<Self, ProtoError> {
        if raw.len() < HEADER_SIZE {
            return Err(ProtoError::BufferTooShort {
                needed: HEADER_SIZE,
                available: raw.len(),
            });
        }
        let header = PacketHeader::decode(&raw[0..HEADER_SIZE])?;
        raw.advance(HEADER_SIZE);
        Ok(Self {
            header,
            payload: raw,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_packet_header_roundtrip() {
        let mut hdr = PacketHeader::new(PacketType::Data, 3, 0xAABBCCDD, 4294967290);
        hdr.flags = PacketHeader::FLAG_URGENT | PacketHeader::FLAG_FEC;

        let mut buf = [0u8; HEADER_SIZE];
        hdr.encode(&mut buf).unwrap();

        let decoded = PacketHeader::decode(&buf).unwrap();
        assert_eq!(hdr, decoded);
    }

    #[test]
    fn test_ack_payload_roundtrip() {
        let ack = AckPayload {
            cumulative_seq: 10542,
            sack_bitmap: 0b1011001,
            rcv_timestamp_us: 1727740800000000,
        };
        let mut buf = BytesMut::new();
        ack.encode(&mut buf);

        let decoded = AckPayload::decode(&buf).unwrap();
        assert_eq!(ack, decoded);
    }

    #[test]
    fn test_probe_payload_roundtrip() {
        let probe = ProbePayload {
            send_timestamp_us: 1000500,
            echo_timestamp_us: 1000850,
            probe_id: 8899,
        };
        let mut buf = BytesMut::new();
        probe.encode(&mut buf);

        let decoded = ProbePayload::decode(&buf).unwrap();
        assert_eq!(probe, decoded);
    }

    #[test]
    fn test_frame_codec() {
        let hdr = PacketHeader::new(PacketType::Data, 1, 0x12345678, 1);
        let payload = Bytes::from_static(b"NexusBond Aggregated Raw IP Payload Data");
        let frame = NexusFrame::new(hdr, payload);

        let encoded = frame.encode().unwrap();
        let decoded = NexusFrame::decode(encoded).unwrap();

        assert_eq!(frame, decoded);
    }

    #[test]
    fn test_reject_corrupted_magic() {
        let mut buf = [0u8; HEADER_SIZE];
        buf[0..4].copy_from_slice(&0xDEADBEEFu32.to_be_bytes());
        buf[4] = PROTOCOL_VERSION;
        buf[5] = PacketType::Data as u8;

        let err = PacketHeader::decode(&buf).unwrap_err();
        assert_eq!(err, ProtoError::InvalidMagic(0xDEADBEEF));
    }
}
