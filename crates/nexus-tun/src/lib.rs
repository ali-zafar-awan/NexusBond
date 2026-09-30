//! Virtual TUN Device & Route Manager (nexus-tun)
//! Cross-platform TUN capture abstraction with leak protection and gateway routing.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum TunError {
    #[error("Failed to create TUN adapter: {0}")]
    CreateFailed(String),
    #[error("Failed to set IP address or route: {0}")]
    RouteFailed(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}

pub struct TunConfig {
    pub name: String,
    pub ip: String,
    pub netmask: String,
    pub mtu: u32,
}

impl Default for TunConfig {
    fn default() -> Self {
        Self {
            name: "nexusbond0".to_string(),
            ip: "10.240.0.2".to_string(),
            netmask: "255.255.255.0".to_string(),
            mtu: 1420,
        }
    }
}
