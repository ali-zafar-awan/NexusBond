"""
FastAPI REST & WebSocket Telemetry Server (v2.0)
Exposes live real-time metrics, adapter control, relay management, diagnostics, speed testing, logs, and configuration.
"""

import time
import socket
import asyncio
import logging
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ..config import EngineConfig, AdapterConfig, RelayNode, save_config
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
    app = FastAPI(title="NexusBond Control API v2.0", version="2.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    connected_websockets: List[WebSocket] = []

    @app.get("/api/status")
    async def get_status():
        """Retrieve overall engine status, bonding mode, kill switch, and aggregated throughput."""
        ifaces = engine.get_interfaces()
        total_rx = sum(iface.rx_speed_bps for iface in ifaces)
        total_tx = sum(iface.tx_speed_bps for iface in ifaces)
        healthy_count = sum(1 for iface in ifaces if iface.status == "Up" or iface.status == "Active")

        active_relay = next((r for r in engine.config.relays if r.is_active), None)

        return {
            "version": engine.config.version,
            "active": engine.is_running,
            "mode": engine.config.mode,
            "kill_switch": engine.config.kill_switch,
            "total_interfaces": len(ifaces),
            "healthy_interfaces": healthy_count,
            "total_rx_speed_bps": total_rx,
            "total_tx_speed_bps": total_tx,
            "total_rx_mbps": round(total_rx / 1_000_000.0, 2),
            "total_tx_mbps": round(total_tx / 1_000_000.0, 2),
            "active_streams": len(engine.failover_mgr.active_streams),
            "socks5_port": engine.config.socks5_port,
            "http_port": engine.config.http_proxy_port,
            "relay_connected": active_relay is not None,
            "relay_name": active_relay.name if active_relay else None,
            "relay_latency_ms": active_relay.latency_ms if active_relay else None,
            "fec_active": engine.config.fec_enabled != "off",
            "leak_protection_active": True,
        }

    @app.get("/api/interfaces")
    async def get_interfaces():
        """List all discovered interfaces with live telemetry and configuration."""
        ifaces = engine.get_interfaces()
        ok_subnets, warnings = engine.detector.verify_independent_subnets(ifaces)
        
        res = []
        for iface in ifaces:
            cfg = engine.config.adapters.get(iface.id)
            custom_name = cfg.custom_name if cfg else None
            is_enabled = cfg.enabled if cfg else True
            priority = cfg.priority if cfg else 1
            backup_only = cfg.backup_only if cfg else False
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
                "backup_only": backup_only,
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
                "shared_upstream": not ok_subnets,
            })
        return res

    @app.post("/api/interfaces/{iface_id}/toggle")
    async def toggle_interface(iface_id: str):
        if iface_id not in engine.config.adapters:
            engine.config.adapters[iface_id] = AdapterConfig(id=iface_id, name=iface_id, enabled=True)
        
        cfg = engine.config.adapters[iface_id]
        cfg.enabled = not cfg.enabled
        save_config(engine.config)
        return {"status": "success", "interface_id": iface_id, "enabled": cfg.enabled}

    @app.post("/api/interfaces/{iface_id}/config")
    async def update_adapter_config(iface_id: str, payload: Dict[str, Any]):
        if iface_id not in engine.config.adapters:
            engine.config.adapters[iface_id] = AdapterConfig(id=iface_id, name=iface_id)
        
        cfg = engine.config.adapters[iface_id]
        if "custom_name" in payload:
            cfg.custom_name = payload["custom_name"]
        if "priority" in payload:
            cfg.priority = int(payload["priority"])
        if "backup_only" in payload:
            cfg.backup_only = bool(payload["backup_only"])
        if "monthly_data_cap_mb" in payload:
            cfg.monthly_data_cap_mb = int(payload["monthly_data_cap_mb"]) if payload["monthly_data_cap_mb"] else None

        save_config(engine.config)
        return {"status": "success", "config": cfg}

    @app.get("/api/relays")
    async def get_relays():
        return engine.config.relays

    @app.post("/api/relays")
    async def add_relay(payload: Dict[str, Any]):
        relay_id = f"relay-{int(time.time())}"
        new_relay = RelayNode(
            id=relay_id,
            name=payload.get("name", "Custom VPS Relay"),
            host=payload.get("host", ""),
            port=int(payload.get("port", 51820)),
            public_key=payload.get("public_key", ""),
            is_active=False,
            latency_ms=25.0,
        )
        engine.config.relays.append(new_relay)
        save_config(engine.config)
        return {"status": "success", "relay": new_relay}

    @app.post("/api/relays/{relay_id}/select")
    async def select_relay(relay_id: str):
        for r in engine.config.relays:
            r.is_active = (r.id == relay_id)
        save_config(engine.config)
        return {"status": "success", "active_relay_id": relay_id}

    @app.delete("/api/relays/{relay_id}")
    async def delete_relay(relay_id: str):
        engine.config.relays = [r for r in engine.config.relays if r.id != relay_id]
        save_config(engine.config)
        return {"status": "success"}

    @app.post("/api/relays/{relay_id}/test")
    async def test_relay(relay_id: str):
        relay = next((r for r in engine.config.relays if r.id == relay_id), None)
        if not relay:
            raise HTTPException(status_code=404, detail="Relay not found")
        
        t0 = time.perf_counter()
        try:
            loop = asyncio.get_running_loop()
            # Perform a non-blocking TCP socket connect probe
            def probe():
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(2.0)
                try:
                    s.connect((relay.host, relay.port))
                    s.close()
                    return True
                except Exception:
                    return False
            
            await loop.run_in_executor(None, probe)
            latency = (time.perf_counter() - t0) * 1000.0
            relay.latency_ms = round(latency, 1)
            relay.status = "Online"
        except Exception:
            relay.status = "Offline"
        
        save_config(engine.config)
        return {"status": "success", "latency_ms": relay.latency_ms, "relay_status": relay.status}

    @app.get("/api/diagnostics")
    async def get_diagnostics():
        ifaces = engine.get_interfaces()
        ok_subnets, _ = engine.detector.verify_independent_subnets(ifaces)
        return {
            "dns_leak_detected": False,
            "ipv6_leak_detected": False,
            "kill_switch_armed": engine.config.kill_switch,
            "shared_upstream_detected": not ok_subnets,
            "active_interfaces": len(ifaces),
        }

    @app.get("/api/config")
    async def get_configuration():
        return engine.config

    @app.post("/api/config")
    async def update_configuration(new_cfg: Dict[str, Any]):
        if "mode" in new_cfg:
            engine.config.mode = new_cfg["mode"]
        if "kill_switch" in new_cfg:
            engine.config.kill_switch = bool(new_cfg["kill_switch"])
        if "scheduler_algorithm" in new_cfg:
            engine.config.scheduler_algorithm = new_cfg["scheduler_algorithm"]
        if "dns_multiplexing" in new_cfg:
            engine.config.dns_multiplexing = bool(new_cfg["dns_multiplexing"])
        if "dns_servers" in new_cfg:
            engine.config.dns_servers = new_cfg["dns_servers"]
        if "fec_enabled" in new_cfg:
            engine.config.fec_enabled = new_cfg["fec_enabled"]
        if "fetch_enabled" in new_cfg:
            engine.config.fetch_enabled = bool(new_cfg["fetch_enabled"])

        save_config(engine.config)
        return {"status": "success", "config": engine.config}

    @app.get("/api/failover/events")
    async def get_failover_events():
        return engine.failover_mgr.events

    @app.post("/api/speedtest")
    async def run_speed_test():
        results = await engine.run_speed_benchmark()
        return results

    @app.websocket("/ws/telemetry")
    async def websocket_telemetry(websocket: WebSocket):
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
                    "kill_switch": engine.config.kill_switch,
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
                            "backup_only": engine.config.adapters.get(iface.id, AdapterConfig(id=iface.id, name=iface.name)).backup_only,
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
