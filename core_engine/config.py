"""
NexusBond Configuration Manager (v2.0)
Handles global settings, adapter profiles, threshold values, relay nodes, and persistent state.
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
    backup_only: bool = False
    weight_override: Optional[float] = None
    monthly_data_cap_mb: Optional[int] = None
    used_data_mb: float = 0.0
    is_metered: bool = False


class RelayNode(BaseModel):
    id: str
    name: str
    host: str
    port: int = 51820
    public_key: str = ""
    is_active: bool = False
    latency_ms: float = 0.0


class EngineConfig(BaseModel):
    version: str = "2.0.0"
    mode: str = "auto"  # "auto", "tunnel_only" (Mode B), "local_only" (Mode A)
    active: bool = True
    kill_switch: bool = False
    
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
    scheduler_algorithm: str = "predictive"  # "predictive", "dynamic_wrr", "latency_aware"
    heartbeat_interval_ms: int = 500
    failover_timeout_ms: int = 1000
    max_chunk_size_kb: int = 256
    
    # Advanced features
    fec_enabled: str = "auto"  # "auto", "on", "off"
    fetch_enabled: bool = True
    
    # DNS Multiplexing
    dns_multiplexing: bool = True
    dns_servers: List[str] = Field(default_factory=lambda: [
        "1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4", "9.9.9.9"
    ])
    
    # Relay Nodes List
    relays: List[RelayNode] = Field(default_factory=lambda: [
        RelayNode(
            id="relay-default-1",
            name="Frankfurt VPS Relay (Default)",
            host="relay.nexusbond.net",
            port=51820,
            public_key="yK8b8kX4d6Q7aB9cE2fG1hJ3lM5nO7pQ",
            is_active=True,
            latency_ms=24.0,
        ),
        RelayNode(
            id="relay-default-2",
            name="US-East Cloud Relay (Standby)",
            host="us-east.nexusbond.net",
            port=51820,
            public_key="pQ7oN5mM3lK1jH3fG1eE2cA9aB9d6X4y",
            is_active=False,
            latency_ms=78.0,
        )
    ])
    
    # Per-Adapter Configuration Map
    adapters: Dict[str, AdapterConfig] = Field(default_factory=dict)


def load_config() -> EngineConfig:
    """Load configuration from persistent JSON store or return defaults with v2 migration."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                
                # Migrate legacy v1 config schema if present
                if "relay" in data and "relays" not in data:
                    r = data.pop("relay")
                    data["relays"] = [
                        {
                            "id": "relay-default-1",
                            "name": "Frankfurt VPS Relay (Default)",
                            "host": r.get("server_address", "relay.nexusbond.net"),
                            "port": r.get("server_port", 51820),
                            "public_key": "yK8b8kX4d6Q7aB9cE2fG1hJ3lM5nO7pQ",
                            "is_active": r.get("enabled", True),
                            "latency_ms": 24.0
                        }
                    ]
                data["version"] = "2.0.0"
                if "fec_enabled" not in data:
                    data["fec_enabled"] = "auto"
                if "fetch_enabled" not in data:
                    data["fetch_enabled"] = True
                if "kill_switch" not in data:
                    data["kill_switch"] = False
                    
                cfg = EngineConfig.model_validate(data)
                save_config(cfg)
                return cfg
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
