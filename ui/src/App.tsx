import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AggregatedSpeed } from './components/AggregatedSpeed';
import { AdapterCard } from './components/AdapterCard';
import { TrafficGraph } from './components/TrafficGraph';
import { ModeSelector } from './components/ModeSelector';
import { SpeedTestModal } from './components/SpeedTestModal';
import { SettingsModal } from './components/SettingsModal';
import { LogsViewer } from './components/LogsViewer';
import { NetworkInterface, EngineStatus, FailoverEvent, SpeedTestResult } from './types';
import { Activity, AlertTriangle, Plus, ShieldCheck, Wifi } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:5000';
const WS_URL = 'ws://127.0.0.1:5000/ws/telemetry';

export const App: React.FC = () => {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [failoverEvents, setFailoverEvents] = useState<FailoverEvent[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'adapters' | 'logs'>('overview');

  // Modals
  const [showModeModal, setShowModeModal] = useState(false);
  const [showSpeedTestModal, setShowSpeedTestModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [statusRes, ifacesRes, eventsRes, cfgRes] = await Promise.all([
        fetch(`${API_BASE}/api/status`).then(r => r.json()),
        fetch(`${API_BASE}/api/interfaces`).then(r => r.json()),
        fetch(`${API_BASE}/api/failover/events`).then(r => r.json()),
        fetch(`${API_BASE}/api/config`).then(r => r.json()),
      ]);
      setStatus(statusRes);
      setInterfaces(ifacesRes);
      setFailoverEvents(eventsRes);
      setConfig(cfgRes);
    } catch (e) {
      console.warn("API not connected or engine is starting up...");
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

            // Update interface dynamic stats
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

  const handleSaveMode = async (mode: 'mode_a' | 'mode_b', relayConfig?: any) => {
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

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <div>
        <Header
          status={status}
          onOpenModeSelector={() => setShowModeModal(true)}
          onOpenSpeedTest={() => setShowSpeedTestModal(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenLogs={() => setActiveTab('logs')}
          activeTab={activeTab}
          setActiveTab={(tab: any) => setActiveTab(tab)}
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

          {/* Audit Logs Tab */}
          {activeTab === 'logs' && (
            <LogsViewer events={failoverEvents} />
          )}
        </main>
      </div>

      {/* Modals */}
      {showModeModal && (
        <ModeSelector
          currentMode={status?.mode || 'mode_a'}
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
          <span>NexusBond Engine v1.0.0 • Open Source Multi-WAN Bonding</span>
          <span className="text-[11px] text-slate-600 font-mono">WinTUN Kernel Virtual Subsystem Active</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
