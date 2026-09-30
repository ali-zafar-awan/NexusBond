export interface NetworkInterface {
  id: string;
  name: string;
  custom_name: string;
  ip_address: string;
  netmask?: string;
  gateway?: string;
  mac_address?: string;
  interface_type: 'Wi-Fi' | 'Ethernet' | 'Cellular' | 'USB Tether' | 'VPN' | 'Bluetooth Tether' | string;
  status: 'Up' | 'Down' | 'Degraded';
  speed_mbps: number;
  is_wireless: boolean;
  is_virtual: boolean;
  enabled: boolean;
  priority: number;
  weight: number;
  latency_ms: number;
  loss_percent: number;
  rx_speed_bps: number;
  tx_speed_bps: number;
  rx_mbps: number;
  tx_mbps: number;
  bytes_sent: number;
  bytes_recv: number;
  monthly_data_cap_mb?: number | null;
  used_data_mb: number;
}

export interface EngineStatus {
  version: string;
  active: boolean;
  mode: 'mode_a' | 'mode_b';
  total_interfaces: number;
  healthy_interfaces: number;
  total_rx_speed_bps: number;
  total_tx_speed_bps: number;
  total_rx_mbps: number;
  total_tx_mbps: number;
  active_streams: number;
  socks5_port: number;
  http_port: number;
}

export interface FailoverEvent {
  timestamp: number;
  failed_interface_id: string;
  failed_interface_name: string;
  target_interface_id: string;
  target_interface_name: string;
  reason: string;
  active_streams_rerouted: number;
}

export interface SpeedTestResult {
  interface_id: string;
  interface_name: string;
  download_mbps: number;
  upload_mbps: number;
  latency_ms: number;
  timestamp: number;
}
