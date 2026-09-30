import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AggregatedSpeed } from './components/AggregatedSpeed';
import { AdapterCard } from './components/AdapterCard';
import { TrafficGraph } from './components/TrafficGraph';
import { ModeSelector } from './components/ModeSelector';
import { SpeedTestModal } from './components/SpeedTestModal';
import { SettingsModal } from './components/SettingsModal';
import { LogsViewer } from './components/LogsViewer';
import { RelayManager } from './components/RelayManager';
import { DiagnosticsView } from './components/DiagnosticsView';
import { FirstRunWizard } from './components/FirstRunWizard';
import { NetworkInterface, EngineStatus, FailoverEvent, SpeedTestResult, RelayNodeInfo, DiagnosticsStatus } from './types';

const API_BASE = 'http://127.0.0.1:5000';
const WS_URL = 'ws://127.0.0.1:5000/ws/telemetry';

export const App: React.FC = () => {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [failoverEvents, setFailoverEvents] = useState<FailoverEvent[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [relays, setRelays] = useState<RelayNodeInfo[]>([
    {
      id: 'relay-default-1',
      name: 'Frankfurt VPS Relay (Default)',
      host: 'relay.nexusbond.net',
      port: 51820,
      public_key: 'yK8b8kX4d6Q7aB9cE2fG1hJ3lM5nO7pQ',
      latency_ms: 24.0,
      is_active: true,
      status: 'Online',
    },
    {
      id: 'relay-default-2',
      name: 'US-East Cloud Relay (Standby)',
      host: 'us-east.nexusbond.net',
      port: 51820,
      public_key: 'pQ7oN5mM3lK1jH3fG1eE2cA9aB9d6X4y',
      latency_ms: 78.0,
      is_active: false,
      status: 'Online',
    }
  ]);
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Modals
  const [showModeModal, setShowModeModal] = useState(false);
  const [showSpeedTestModal, setShowSpeedTestModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [statusRes, ifacesRes, eventsRes, cfgRes, relaysRes] = await Promise.all([
        fetch(`${API_BASE}/api/status`).then(r => r.json()),
        fetch(`${API_BASE}/api/interfaces`).then(r => r.json()),
        fetch(`${API_BASE}/api/failover/events`).then(r => r.json()),
        fetch(`${API_BASE}/api/config`).then(r => r.json()),
        fetch(`${API_BASE}/api/relays`).then(r => r.json()).catch(() => []),
      ]);
      setStatus(statusRes);
      setInterfaces(ifacesRes);
      setFailoverEvents(eventsRes);
      setConfig(cfgRes);
      if (Array.isArray(relaysRes) && relaysRes.length > 0) {
        setRelays(relaysRes);
      }
    } catch (e) {
      console.warn("NexusBond API connection waiting...");
    }
  };

  useEffect(() => {
    fetchData();

    // WebSocket real-time telemetry loop
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connectWS = () => {
      try {
        ws = new WebSocket(WS_URL);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setStatus(prev => prev ? {
              ...prev,
              total_rx_mbps: data.total_rx_mbps,
              total_tx_mbps: data.total_tx_mbps,
              active_streams: data.active_streams,
              mode: data.mode,
            } : null);

            if (data.interfaces) {
              setInterfaces(prev => {
                const map = new Map<string, any>(data.interfaces.map((i: any) => [i.id, i]));
                return prev.map(existing => {
                  const updated = map.get(existing.id);
                  if (updated) {
                    return {
                      ...existing,
                      status: updated.status,
                      rx_mbps: updated.rx_mbps,
                      tx_mbps: updated.tx_mbps,
                      latency_ms: updated.latency_ms,
                      loss_percent: updated.loss_percent,
                      weight: updated.weight,
                      enabled: updated.enabled,
                    };
                  }
                  return existing;
                });
              });
            }
          } catch (err) {}
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(connectWS, 2000);
        };
        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        reconnectTimer = setTimeout(connectWS, 2000);
      }
    };

    connectWS();
    const interval = setInterval(fetchData, 4000);

    return () => {
      clearInterval(interval);
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const handleToggleInterface = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/interfaces/${encodeURIComponent(id)}/toggle`, {
        method: 'POST'
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateAdapterConfig = async (id: string, customName: string, priority: number, dataCap: number | null) => {
    try {
      await fetch(`${API_BASE}/api/interfaces/${encodeURIComponent(id)}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_name: customName,
          priority: priority,
          monthly_data_cap_mb: dataCap
        })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleKillSwitch = async () => {
    const nextState = !(status?.kill_switch ?? false);
    setStatus(prev => prev ? { ...prev, kill_switch: nextState } : null);
    try {
      await fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kill_switch: nextState })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveMode = async (mode: any, relayConfig?: any) => {
    try {
      await fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: mode,
          relay: relayConfig
        })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (newCfg: any) => {
    try {
      await fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCfg)
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunSpeedTest = async (): Promise<SpeedTestResult[]> => {
    const res = await fetch(`${API_BASE}/api/speedtest`, { method: 'POST' });
    return await res.json();
  };

  const handleRunDiagnostics = async (): Promise<DiagnosticsStatus> => {
    try {
      const res = await fetch(`${API_BASE}/api/diagnostics`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error("Failed to run diagnostics", e);
    }
    return {
      dns_leak_detected: false,
      ipv6_leak_detected: false,
      kill_switch_armed: status?.kill_switch ?? false,
      shared_upstream_detected: false,
    };
  };

  const handleAddRelay = async (rName: string, rHost: string, rPort: number, rPubKey: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/relays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: rName, host: rHost, port: rPort, public_key: rPubKey }),
      });
      if (res.ok) {
        const relaysRes = await fetch(`${API_BASE}/api/relays`).then(r => r.json());
        if (Array.isArray(relaysRes)) setRelays(relaysRes);
      }
    } catch (e) {
      console.error("Failed to add relay", e);
    }
  };

  const handleSelectRelay = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/relays/${encodeURIComponent(id)}/select`, { method: 'POST' });
      const relaysRes = await fetch(`${API_BASE}/api/relays`).then(r => r.json());
      if (Array.isArray(relaysRes)) setRelays(relaysRes);
    } catch (e) {
      console.error("Failed to select relay", e);
      setRelays(prev => prev.map(r => ({ ...r, is_active: r.id === id })));
    }
  };

  const handleRemoveRelay = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/relays/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const relaysRes = await fetch(`${API_BASE}/api/relays`).then(r => r.json());
      if (Array.isArray(relaysRes)) setRelays(relaysRes);
    } catch (e) {
      console.error("Failed to remove relay", e);
      setRelays(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleTestRelay = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/relays/${encodeURIComponent(id)}/test`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setRelays(prev => prev.map(r => r.id === id ? { ...r, latency_ms: data.latency_ms, status: data.relay_status || 'Online' } : r));
      }
    } catch (e) {
      console.error("Failed to test relay", e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <div>
        <Header
          status={status}
          onOpenModeSelector={() => setShowModeModal(true)}
          onOpenSpeedTest={() => setShowSpeedTestModal(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenWizard={() => setShowWizard(true)}
          onToggleKillSwitch={handleToggleKillSwitch}
          activeTab={activeTab}
          setActiveTab={(tab: string) => setActiveTab(tab)}
        />

        <main className="max-w-7xl mx-auto px-6 pb-12">
          {/* Overview Dashboard Tab */}
          {activeTab === 'overview' && (
            <>
              <AggregatedSpeed status={status} />

              <TrafficGraph
                interfaces={interfaces}
                totalRxMbps={status?.total_rx_mbps || 0}
                totalTxMbps={status?.total_tx_mbps || 0}
              />

              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Active Physical Adapters</h2>
                    <p className="text-xs text-slate-400">Real-time status and throughput per network interface</p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {interfaces.length} Adapters Detected
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {interfaces.map(iface => (
                    <AdapterCard
                      key={iface.id}
                      adapter={iface}
                      onToggle={handleToggleInterface}
                      onUpdateConfig={handleUpdateAdapterConfig}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Adapters Tab */}
          {activeTab === 'adapters' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Network Interface Management</h2>
                  <p className="text-xs text-slate-400">Configure priorities, custom names, and monthly bandwidth quotas</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {interfaces.map(iface => (
                  <AdapterCard
                    key={iface.id}
                    adapter={iface}
                    onToggle={handleToggleInterface}
                    onUpdateConfig={handleUpdateAdapterConfig}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Relays Tab (v2) */}
          {activeTab === 'relays' && (
            <RelayManager
              relays={relays}
              onSelectRelay={handleSelectRelay}
              onAddRelay={handleAddRelay}
              onRemoveRelay={handleRemoveRelay}
              onTestRelay={handleTestRelay}
            />
          )}

          {/* Diagnostics Tab (v2) */}
          {activeTab === 'diagnostics' && (
            <DiagnosticsView
              interfaces={interfaces}
              killSwitchArmed={status?.kill_switch ?? false}
              onRunDiagnostics={handleRunDiagnostics}
            />
          )}

          {/* Audit Logs Tab */}
          {activeTab === 'logs' && (
            <LogsViewer events={failoverEvents} />
          )}
        </main>
      </div>

      {/* Modals */}
      {showWizard && (
        <FirstRunWizard
          interfaces={interfaces}
          onClose={() => setShowWizard(false)}
          onComplete={(selectedMode) => {
            handleSaveMode(selectedMode);
            setShowWizard(false);
          }}
        />
      )}

      {showModeModal && (
        <ModeSelector
          currentMode={(status?.mode as any) || 'auto'}
          onClose={() => setShowModeModal(false)}
          onSaveMode={handleSaveMode}
        />
      )}

      {showSpeedTestModal && (
        <SpeedTestModal
          onClose={() => setShowSpeedTestModal(false)}
          onRunSpeedTest={handleRunSpeedTest}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          currentConfig={config}
          onClose={() => setShowSettingsModal(false)}
          onSaveConfig={handleSaveSettings}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>NexusBond v2.0.0 • High-Performance Rust Multi-WAN Bonding</span>
          <span className="text-[11px] text-slate-600 font-mono">Noise_IK Encrypted Packet Data Plane</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
