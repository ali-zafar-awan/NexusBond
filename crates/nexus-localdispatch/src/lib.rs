//! Local Smart Dispatch Engine (nexus-localdispatch)
//! Zero-cost local multi-WAN SOCKS5/HTTP transparent proxy and parallel DNS racing.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum DispatchError {
    #[error("Proxy bind failed on {0}")]
    Bind(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}
