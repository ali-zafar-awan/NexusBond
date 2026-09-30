//! Link Monitor & Delivery Rate Estimator (nexus-linkmon)
//! Discovers network interfaces, binds sockets directly to source IPs/devices,
//! and maintains live RTT, loss, and delivery-rate estimates.

use std::net::IpAddr;
use std::time::{Duration, Instant};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LinkError {
    #[error("Socket bind failed on {ip}: {source}")]
    BindError {
        ip: IpAddr,
        #[source]
        source: std::io::Error,
    },
    #[error("Interface not found: {0}")]
    NotFound(String),
    #[error("Probe timed out on link {0}")]
    Timeout(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinkState {
    Active,
    Degraded,
    Down,
    Standby,
}

#[derive(Debug, Clone)]
pub struct LinkMetrics {
    pub link_id: u8,
    pub name: String,
    pub ip: IpAddr,
    pub state: LinkState,
    pub rtt: Duration,
    pub min_rtt: Duration,
    pub loss_ratio: f64,
    pub delivery_rate_bps: u64,
    pub last_probe: Option<Instant>,
}

impl LinkMetrics {
    pub fn new(link_id: u8, name: String, ip: IpAddr) -> Self {
        Self {
            link_id,
            name,
            ip,
            state: LinkState::Active,
            rtt: Duration::from_millis(20),
            min_rtt: Duration::from_millis(20),
            loss_ratio: 0.0,
            delivery_rate_bps: 100_000_000, // 100 Mbps initial estimate
            last_probe: None,
        }
    }

    pub fn update_probe(&mut self, sample_rtt: Duration, success: bool) {
        self.last_probe = Some(Instant::now());
        if success {
            if sample_rtt < self.min_rtt {
                self.min_rtt = sample_rtt;
            }
            // Exponentially Weighted Moving Average (EWMA)
            self.rtt = Duration::from_micros(
                (self.rtt.as_micros() as f64 * 0.7 + sample_rtt.as_micros() as f64 * 0.3) as u64,
            );
            self.loss_ratio = (self.loss_ratio * 0.9).max(0.0);
            self.state = if self.loss_ratio > 0.3 || self.rtt > Duration::from_millis(350) {
                LinkState::Degraded
            } else {
                LinkState::Active
            };
        } else {
            self.loss_ratio = (self.loss_ratio * 0.9 + 0.1).min(1.0);
            if self.loss_ratio >= 0.8 {
                self.state = LinkState::Down;
            } else {
                self.state = LinkState::Degraded;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    #[test]
    fn test_link_metrics_update() {
        let mut link = LinkMetrics::new(1, "WiFi".to_string(), IpAddr::V4(Ipv4Addr::new(192, 168, 1, 50)));
        assert_eq!(link.state, LinkState::Active);

        link.update_probe(Duration::from_millis(15), true);
        assert_eq!(link.state, LinkState::Active);
        assert!(link.min_rtt <= Duration::from_millis(15));
    }
}
