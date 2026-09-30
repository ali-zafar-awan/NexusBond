//! Parallel Chunk Fetcher (nexus-fetch)
//! Stripes large downloads across multiple active connections via HTTP Range requests.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum FetchError {
    #[error("Server does not support HTTP Range requests for {0}")]
    NoRangeSupport(String),
    #[error("Chunk download failed on link {link_id}: {reason}")]
    ChunkFailed { link_id: u8, reason: String },
}
