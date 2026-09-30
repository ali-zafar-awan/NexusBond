//! Packet Scheduler & Reorder Buffer (nexus-sched)
//! Implements predictive delivery scheduling, reorder window, and packet deduplication according to SRS v2.0 Section 6.

use std::collections::BTreeMap;
use std::time::Instant;
use bytes::Bytes;
use nexus_linkmon::LinkMetrics;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SchedError {
    #[error("No active link available for scheduling")]
    NoActiveLinks,
    #[error("Reorder buffer overflow")]
    BufferOverflow,
}

/// Reorder buffer for reassembling out-of-order packets received from multiple links.
pub struct ReorderBuffer {
    expected_seq: u32,
    buffer: BTreeMap<u32, (Bytes, Instant)>,
    max_capacity: usize,
}

impl Default for ReorderBuffer {
    fn default() -> Self {
        Self::new(1024)
    }
}

impl ReorderBuffer {
    pub fn new(max_capacity: usize) -> Self {
        Self {
            expected_seq: 1,
            buffer: BTreeMap::new(),
            max_capacity,
        }
    }

    /// Insert a packet and return all in-order consecutive packets available for delivery.
    pub fn insert(&mut self, seq: u32, payload: Bytes) -> Result<Vec<Bytes>, SchedError> {
        if seq < self.expected_seq {
            // Late duplicate packet, drop
            return Ok(Vec::new());
        }

        if self.buffer.len() >= self.max_capacity {
            return Err(SchedError::BufferOverflow);
        }

        self.buffer.insert(seq, (payload, Instant::now()));

        let mut ready = Vec::new();
        while let Some((&seq, _)) = self.buffer.iter().next() {
            if seq == self.expected_seq {
                if let Some((pkt, _)) = self.buffer.remove(&seq) {
                    ready.push(pkt);
                    self.expected_seq = self.expected_seq.wrapping_add(1);
                }
            } else {
                break;
            }
        }

        Ok(ready)
    }
}

/// Predictive scheduler choosing link with earliest predicted arrival time:
/// EstimatedArrival = Now + OneWayDelay + (InFlightBytes / DeliveryRate)
pub struct PredictiveScheduler;

impl PredictiveScheduler {
    pub fn select_link<'a>(links: &'a [LinkMetrics], packet_len: usize) -> Result<&'a LinkMetrics, SchedError> {
        let active_links: Vec<&LinkMetrics> = links
            .iter()
            .filter(|l| l.state == nexus_linkmon::LinkState::Active)
            .collect();

        if active_links.is_empty() {
            return Err(SchedError::NoActiveLinks);
        }

        if active_links.len() == 1 {
            return Ok(active_links[0]);
        }

        // Pick link minimizing predicted arrival time
        let best = active_links
            .into_iter()
            .min_by_key(|l| {
                let delay_us = l.rtt.as_micros() / 2;
                let rate_bps = l.delivery_rate_bps.max(1_000_000);
                let tx_time_us = (packet_len as u128 * 8 * 1_000_000) / rate_bps as u128;
                delay_us + tx_time_us
            })
            .ok_or(SchedError::NoActiveLinks)?;

        Ok(best)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reorder_buffer_in_order() {
        let mut buf = ReorderBuffer::new(64);
        let out1 = buf.insert(1, Bytes::from_static(b"pkt1")).unwrap();
        assert_eq!(out1.len(), 1);

        let out2 = buf.insert(2, Bytes::from_static(b"pkt2")).unwrap();
        assert_eq!(out2.len(), 1);
    }

    #[test]
    fn test_reorder_buffer_out_of_order() {
        let mut buf = ReorderBuffer::new(64);
        // pkt 2 arrives first
        let out = buf.insert(2, Bytes::from_static(b"pkt2")).unwrap();
        assert_eq!(out.len(), 0);

        // pkt 1 arrives -> both should be emitted in order
        let out = buf.insert(1, Bytes::from_static(b"pkt1")).unwrap();
        assert_eq!(out.len(), 2);
        assert_eq!(out[0], Bytes::from_static(b"pkt1"));
        assert_eq!(out[1], Bytes::from_static(b"pkt2"));
    }
}
