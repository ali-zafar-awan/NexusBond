"""
NexusBond Configuration Manager
Handles global settings, adapter profiles, threshold values, and persistent state.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

CONFIG_DIR = Path(os.getenv("APPDATA", str(Path.home()))) / "NexusBond"
CONFIG_FILE = CONFIG_DIR / "config.json"


class AdapterConfig(BaseModel):
    id: str
    name: str
    custom_name: Optional[str] = None
    enabled: bool = True
    priority: int = 1  # 1 = Highest, 5 = Lowest
    weight_override: Optional[float] = None  # None = dynamic calculation
    monthly_data_cap_mb: Optional[int] = None  # None = unlimited
    used_data_mb: float = 0.0
    is_metered: bool = False


class RelayConfig(BaseModel):
    enabled: bool = False
    server_address: str = "relay.nexusbond.net"
    server_port: int = 51820
    auth_key: str = ""
    protocol: str = "wireguard"  # "wireguard", "mptcp", "udp_stripe"
    encryption: bool = True


class EngineConfig(BaseModel):
    version: str = "1.0.0"
    mode: str = "mode_a"  # "mode_a" (Smart Dispatch) or "mode_b" (Multipath Bonding Tunnel)
    active: bool = True
    
    # Proxy Settings
    socks5_enabled: bool = True
    socks5_host: str = "127.0.0.1"
    socks5_port: int = 1080
    
    http_proxy_enabled: bool = True
    http_proxy_host: str = "127.0.0.1"
    http_proxy_port: int = 8080
    
    # API & WebSocket Settings
    api_host: str = "127.0.0.1"
    api_port: int = 5000
    
    # Routing & Scheduling
    scheduler_algorithm: str = "dynamic_wrr"  # "dynamic_wrr", "latency_aware", "round_robin", "loss_speculative"
    heartbeat_interval_ms: int = 500
    failover_timeout_ms: int = 1000
    max_chunk_size_kb: int = 256
    
    # DNS Multiplexing
    dns_multiplexing: bool = True
    dns_servers: List[str] = Field(default_factory=lambda: [
        "1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4", "9.9.9.9"
    ])
    
    # Relay (Mode B)
    relay: RelayConfig = Field(default_factory=RelayConfig)
    
    # Per-Adapter Configuration Map
    adapters: Dict[str, AdapterConfig] = Field(default_factory=dict)


def load_config() -> EngineConfig:
    """Load configuration from persistent JSON store or return defaults."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return EngineConfig.model_validate(data)
        except Exception as e:
            print(f"[NexusBond Config] Error reading config file: {e}. Using defaults.")
    
    cfg = EngineConfig()
    save_config(cfg)
    return cfg


def save_config(config: EngineConfig) -> bool:
    """Save configuration to JSON file."""
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            f.write(config.model_dump_json(indent=2))
        return True
    except Exception as e:
        print(f"[NexusBond Config] Failed to save config: {e}")
        return False
