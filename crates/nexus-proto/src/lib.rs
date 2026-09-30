//! NexusBond Wire Protocol (nexus-proto)
//! Defines frame headers, packet types, session handshakes, and serialization according to SRS v2.0 Section 5.

use thiserror::Error;

/// Protocol magic header bytes: 0x4E584244 ("NXBD")
pub const PROTOCOL_MAGIC: u32 = 0x4E584244;
pub const PROTOCOL_VERSION: u8 = 2;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum ProtoError {
    #[error("Invalid magic bytes: expected 0x{PROTOCOL_MAGIC:08X}, got 0x{0:08X}")]
    InvalidMagic(u32),
    #[error("Unsupported protocol version: {0}")]
    UnsupportedVersion(u8),
    #[error("Buffer too short: needed {needed}, available {available}")]
    BufferTooShort { needed: usize, available: usize },
    #[error("Invalid packet type: {0}")]
    InvalidPacketType(u8),
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

/// Fixed NexusBond Packet Header (16 bytes)
/// [ Magic (4B) | Version (1B) | PacketType (1B) | LinkId (1B) | Flags (1B) | SessionID (4B) | Sequence (4B) ]
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
    pub const SIZE: usize = 16;

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
        if buf.len() < Self::SIZE {
            return Err(ProtoError::BufferTooShort {
                needed: Self::SIZE,
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
        if buf.len() < Self::SIZE {
            return Err(ProtoError::BufferTooShort {
                needed: Self::SIZE,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_header_encode_decode() {
        let hdr = PacketHeader::new(PacketType::Data, 2, 0x12345678, 100);
        let mut buf = [0u8; PacketHeader::SIZE];
        hdr.encode(&mut buf).unwrap();

        let decoded = PacketHeader::decode(&buf).unwrap();
        assert_eq!(hdr, decoded);
    }
}
