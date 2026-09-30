import React, { useState } from 'react';
import { X, Sliders, Check, Server, Shield, Network, RefreshCw } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  currentConfig: any;
  onSaveConfig: (cfg: any) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  currentConfig,
  onSaveConfig
}) => {
  const [scheduler, setScheduler] = useState(currentConfig?.scheduler_algorithm || 'dynamic_wrr');
  const [dnsMultiplexing, setDnsMultiplexing] = useState(currentConfig?.dns_multiplexing ?? true);
  const [socksPort, setSocksPort] = useState(currentConfig?.socks5_port || 1080);
  const [httpPort, setHttpPort] = useState(currentConfig?.http_proxy_port || 8080);
  const [failoverMs, setFailoverMs] = useState(currentConfig?.failover_timeout_ms || 1000);

  const handleSave = () => {
    onSaveConfig({
      ...currentConfig,
      scheduler_algorithm: scheduler,
      dns_multiplexing: dnsMultiplexing,
      socks5_port: socksPort,
      http_proxy_port: httpPort,
      failover_timeout_ms: failoverMs,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="glass-panel w-full max-w-xl rounded-3xl p-6 relative border border-white/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-white/10 mb-2">
            <Sliders className="w-3.5 h-3.5" /> Engine Settings
          </div>
          <h2 className="text-xl font-bold text-white">System Configuration</h2>
          <p className="text-xs text-slate-400 mt-1">
            Tune scheduler metrics, proxy ports, failover thresholds, and DNS resolution.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {/* Scheduling Algorithm */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Traffic Scheduling Strategy
            </label>
            <select
              value={scheduler}
              onChange={(e) => setScheduler(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="dynamic_wrr">Dynamic Weighted Round-Robin (Throughput & Latency Adaptive)</option>
              <option value="latency_aware">Latency-Aware (Prioritize Gaming/VoIP to lowest ping link)</option>
              <option value="loss_speculative">Loss-Speculative (Duplicate critical control packets)</option>
              <option value="round_robin">Strict Round-Robin (Equal packet distribution)</option>
            </select>
          </div>

          {/* Proxy Ports */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                SOCKS5 Multi-WAN Port
              </label>
              <input
                type="number"
                value={socksPort}
                onChange={(e) => setSocksPort(parseInt(e.target.value) || 1080)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                HTTP / HTTPS Proxy Port
              </label>
              <input
                type="number"
                value={httpPort}
                onChange={(e) => setHttpPort(parseInt(e.target.value) || 8080)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Failover Threshold */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Failover Trigger Timeout (ms)
            </label>
            <input
              type="number"
              value={failoverMs}
              onChange={(e) => setFailoverMs(parseInt(e.target.value) || 1000)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Sub-second reroute occurs if interface drops packets for longer than this duration.
            </span>
          </div>

          {/* DNS Multiplexing Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-white/5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Parallel DNS Racing</div>
              <div className="text-[11px] text-slate-400">Race queries across all adapters for sub-millisecond lookup</div>
            </div>
            <input
              type="checkbox"
              checked={dnsMultiplexing}
              onChange={(e) => setDnsMultiplexing(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-800 border-white/10"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
