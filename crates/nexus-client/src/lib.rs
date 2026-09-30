//! NexusBond Client Library (nexus-client)
//! Manages auto mode transitions, link monitoring, predictive scheduling, and virtual TUN routing.

pub struct ClientConfig {
    pub mode: String,
    pub kill_switch: bool,
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            mode: "auto".to_string(),
            kill_switch: false,
        }
    }
}
