//! Local IPC & JSON-RPC Server (nexus-ipc)
//! Exposes typed control endpoints and real-time telemetry over local domain sockets / named pipes.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum IpcError {
    #[error("IPC connection error: {0}")]
    Connection(String),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TelemetrySnapshot {
    pub timestamp_ms: u64,
    pub total_rx_bps: u64,
    pub total_tx_bps: u64,
    pub mode: String,
    pub active_links: u8,
}
