//! NexusBond Relay Core Engine (nexus-relay)
//! Multiplexes and reassembles multi-path client subflows on a Linux VPS / relay server.

pub struct RelayServerConfig {
    pub bind_addr: String,
    pub port: u16,
}

impl Default for RelayServerConfig {
    fn default() -> Self {
        Self {
            bind_addr: "0.0.0.0".to_string(),
            port: 51820,
        }
    }
}
