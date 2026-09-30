"""
FastAPI REST & WebSocket Telemetry Server
Exposes live real-time metrics, adapter control, speed testing, logs, and configuration to the Frontend Dashboard.
"""

import time
import socket
import asyncio
import logging
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ..config import EngineConfig, AdapterConfig, save_config
from ..interfaces.detector import NetworkInterfaceInfo

logger = logging.getLogger("NexusBond.API")


class SpeedTestResult(BaseModel):
    interface_id: str
    interface_name: str
    download_mbps: float
    upload_mbps: float
    latency_ms: float
    timestamp: float


def create_api_app(engine) -> FastAPI:
    app = FastAPI(title="NexusBond Control API", version="1.0.0")

    # Enable CORS for frontend dashboard
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Active WebSocket clients
    connected_websockets: List[WebSocket] = []

    @app.get("/api/status")
    async def get_status():
        """Retrieve overall engine status, bonding mode, and aggregated throughput."""
        ifaces = engine.get_interfaces()
        total_rx = sum(iface.rx_speed_bps for iface in ifaces)
        total_tx = sum(iface.tx_speed_bps for iface in ifaces)
        healthy_count = sum(1 for iface in ifaces if iface.status == "Up")

        return {
            "version": engine.config.version,
            "active": engine.is_running,
            "mode": engine.config.mode,
            "total_interfaces": len(ifaces),
            "healthy_interfaces": healthy_count,
            "total_rx_speed_bps": total_rx,
            "total_tx_speed_bps": total_tx,
            "total_rx_mbps": round(total_rx / 1_000_000.0, 2),
            "total_tx_mbps": round(total_tx / 1_000_000.0, 2),
            "active_streams": len(engine.failover_mgr.active_streams),
            "socks5_port": engine.config.socks5_port,
            "http_port": engine.config.http_proxy_port,
        }

    @app.get("/api/interfaces")
    async def get_interfaces():
        """List all discovered interfaces with live stats and config overrides."""
        ifaces = engine.get_interfaces()
        res = []
        for iface in ifaces:
            cfg = engine.config.adapters.get(iface.id)
            custom_name = cfg.custom_name if cfg else None
            is_enabled = cfg.enabled if cfg else True
            priority = cfg.priority if cfg else 1
            data_cap = cfg.monthly_data_cap_mb if cfg else None
            used_data = cfg.used_data_mb if cfg else 0.0

            res.append({
                "id": iface.id,
                "name": iface.name,
                "custom_name": custom_name or iface.name,
                "ip_address": iface.ip_address,
                "netmask": iface.netmask,
                "gateway": iface.gateway,
                "mac_address": iface.mac_address,
                "interface_type": iface.interface_type,
                "status": iface.status,
                "speed_mbps": iface.speed_mbps,
                "is_wireless": iface.is_wireless,
                "is_virtual": iface.is_virtual,
                "enabled": is_enabled,
                "priority": priority,
                "weight": iface.weight,
                "latency_ms": iface.latency_ms,
                "loss_percent": iface.loss_percent,
                "rx_speed_bps": iface.rx_speed_bps,
                "tx_speed_bps": iface.tx_speed_bps,
                "rx_mbps": round(iface.rx_speed_bps / 1_000_000.0, 2),
                "tx_mbps": round(iface.tx_speed_bps / 1_000_000.0, 2),
                "bytes_sent": iface.bytes_sent,
                "bytes_recv": iface.bytes_recv,
                "monthly_data_cap_mb": data_cap,
                "used_data_mb": round(used_data, 1),
            })
        return res

    @app.post("/api/interfaces/{iface_id}/toggle")
    async def toggle_interface(iface_id: str):
        """Enable or disable a specific network interface."""
        if iface_id not in engine.config.adapters:
            engine.config.adapters[iface_id] = AdapterConfig(id=iface_id, name=iface_id, enabled=True)
        
        cfg = engine.config.adapters[iface_id]
        cfg.enabled = not cfg.enabled
        save_config(engine.config)
        return {"status": "success", "interface_id": iface_id, "enabled": cfg.enabled}

    @app.post("/api/interfaces/{iface_id}/config")
    async def update_adapter_config(iface_id: str, payload: Dict[str, Any]):
        """Update custom name, priority, or data cap for an adapter."""
        if iface_id not in engine.config.adapters:
            engine.config.adapters[iface_id] = AdapterConfig(id=iface_id, name=iface_id)
        
        cfg = engine.config.adapters[iface_id]
        if "custom_name" in payload:
            cfg.custom_name = payload["custom_name"]
        if "priority" in payload:
            cfg.priority = int(payload["priority"])
        if "monthly_data_cap_mb" in payload:
            cfg.monthly_data_cap_mb = int(payload["monthly_data_cap_mb"]) if payload["monthly_data_cap_mb"] else None

        save_config(engine.config)
        return {"status": "success", "config": cfg}

    @app.get("/api/config")
    async def get_configuration():
        """Get full configuration."""
        return engine.config

    @app.post("/api/config")
    async def update_configuration(new_cfg: Dict[str, Any]):
        """Update global engine configuration."""
        if "mode" in new_cfg:
            engine.config.mode = new_cfg["mode"]
        if "scheduler_algorithm" in new_cfg:
            engine.config.scheduler_algorithm = new_cfg["scheduler_algorithm"]
        if "dns_multiplexing" in new_cfg:
            engine.config.dns_multiplexing = bool(new_cfg["dns_multiplexing"])
        if "dns_servers" in new_cfg:
            engine.config.dns_servers = new_cfg["dns_servers"]
        if "relay" in new_cfg:
            for k, v in new_cfg["relay"].items():
                setattr(engine.config.relay, k, v)

        save_config(engine.config)
        return {"status": "success", "config": engine.config}

    @app.get("/api/failover/events")
    async def get_failover_events():
        """Retrieve recent failover events."""
        return engine.failover_mgr.events

    @app.post("/api/speedtest")
    async def run_speed_test():
        """Execute a live multi-WAN download benchmark test."""
        results = await engine.run_speed_benchmark()
        return results

    @app.websocket("/ws/telemetry")
    async def websocket_telemetry(websocket: WebSocket):
        """High-frequency real-time telemetry stream for UI graphs."""
        await websocket.accept()
        connected_websockets.append(websocket)
        try:
            while True:
                ifaces = engine.get_interfaces()
                total_rx = sum(iface.rx_speed_bps for iface in ifaces)
                total_tx = sum(iface.tx_speed_bps for iface in ifaces)

                data = {
                    "timestamp": time.time(),
                    "total_rx_mbps": round(total_rx / 1_000_000.0, 2),
                    "total_tx_mbps": round(total_tx / 1_000_000.0, 2),
                    "active_streams": len(engine.failover_mgr.active_streams),
                    "mode": engine.config.mode,
                    "interfaces": [
                        {
                            "id": iface.id,
                            "name": iface.name,
                            "custom_name": engine.config.adapters.get(iface.id, AdapterConfig(id=iface.id, name=iface.name)).custom_name or iface.name,
                            "status": iface.status,
                            "rx_mbps": round(iface.rx_speed_bps / 1_000_000.0, 2),
                            "tx_mbps": round(iface.tx_speed_bps / 1_000_000.0, 2),
                            "latency_ms": iface.latency_ms,
                            "loss_percent": iface.loss_percent,
                            "weight": iface.weight,
                            "enabled": engine.config.adapters.get(iface.id, AdapterConfig(id=iface.id, name=iface.name)).enabled,
                        }
                        for iface in ifaces
                    ]
                }
                await websocket.send_json(data)
                await asyncio.sleep(0.5)
        except WebSocketDisconnect:
            pass
        except Exception:
            pass
        finally:
            if websocket in connected_websockets:
                connected_websockets.remove(websocket)

    return app
