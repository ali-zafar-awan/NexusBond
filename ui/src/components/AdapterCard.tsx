import React, { useState } from 'react';
import { 
  Wifi, 
  Network, 
  Smartphone, 
  ShieldAlert, 
  Activity, 
  Clock, 
  Percent, 
  ArrowDownRight, 
  ArrowUpRight, 
  Power,
  Edit2,
  Check,
  HardDrive
} from 'lucide-react';
import { NetworkInterface } from '../types';

interface AdapterCardProps {
  adapter: NetworkInterface;
  onToggle: (id: string) => void;
  onUpdateConfig: (id: string, customName: string, priority: number, dataCap: number | null) => void;
}

export const AdapterCard: React.FC<AdapterCardProps> = ({
  adapter,
  onToggle,
  onUpdateConfig
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [customName, setCustomName] = useState(adapter.custom_name || adapter.name);
  const [priority, setPriority] = useState(adapter.priority || 1);

  const getIcon = () => {
    switch (adapter.interface_type) {
      case 'Wi-Fi':
        return <Wifi className="w-5 h-5 text-cyan-400" />;
      case 'Cellular':
      case 'USB Tether':
        return <Smartphone className="w-5 h-5 text-indigo-400" />;
      default:
        return <Network className="w-5 h-5 text-emerald-400" />;
    }
  };

  const getStatusColor = () => {
    if (!adapter.enabled) return 'bg-slate-700 text-slate-400 border-slate-600';
    switch (adapter.status) {
      case 'Up':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Degraded':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  };

  const handleSaveEdit = () => {
    onUpdateConfig(adapter.id, customName, priority, adapter.monthly_data_cap_mb || null);
    setIsEditing(false);
  };

  // Data quota calculation
  const capMb = adapter.monthly_data_cap_mb;
  const usedMb = adapter.used_data_mb || 0;
  const quotaPercent = capMb ? Math.min(100, (usedMb / capMb) * 100) : 0;

  return (
    <div className={`glass-card rounded-2xl p-5 relative transition-all duration-300 flex flex-col justify-between ${
      !adapter.enabled ? 'opacity-50 grayscale' : 'hover:shadow-lg hover:shadow-indigo-500/5'
    }`}>
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-white/5">
              {getIcon()}
            </div>
            <div>
              {isEditing ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="bg-slate-900 px-2 py-0.5 rounded border border-indigo-500 text-xs text-white focus:outline-none"
                    placeholder="Custom Label"
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white tracking-tight truncate max-w-[150px]">
                    {adapter.custom_name || adapter.name}
                  </h3>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                {adapter.ip_address}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${getStatusColor()}`}>
              {adapter.enabled ? adapter.status : 'Disabled'}
            </span>
            <button
              onClick={() => onToggle(adapter.id)}
              className={`p-1.5 rounded-lg border transition-all ${
                adapter.enabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-emerald-400'
              }`}
              title={adapter.enabled ? 'Disable Interface' : 'Enable Interface'}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Real-Time Live Speeds */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="p-2.5 rounded-xl bg-slate-900/40 border border-white/5">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-cyan-400" />
              <span>Download</span>
            </div>
            <div className="text-sm font-bold font-mono text-white">
              {adapter.rx_mbps.toFixed(2)} <span className="text-[10px] text-slate-400">Mbps</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/40 border border-white/5">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
              <span>Upload</span>
            </div>
            <div className="text-sm font-bold font-mono text-white">
              {adapter.tx_mbps.toFixed(2)} <span className="text-[10px] text-slate-400">Mbps</span>
            </div>
          </div>
        </div>

        {/* Latency & Loss Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-4">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/30">
            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
              <Clock className="w-3 h-3 text-slate-500" /> Ping RTT
            </span>
            <span className={`font-mono font-medium ${
              adapter.latency_ms < 30 ? 'text-emerald-400' : adapter.latency_ms < 80 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {adapter.latency_ms.toFixed(0)} ms
            </span>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/30">
            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
              <Percent className="w-3 h-3 text-slate-500" /> Loss
            </span>
            <span className={`font-mono font-medium ${
              adapter.loss_percent === 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {adapter.loss_percent.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Scheduler Weight Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span>Scheduler Allocation</span>
            <span className="font-mono text-indigo-300 font-semibold">
              {(adapter.weight * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(100, adapter.weight * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Data Quota / Cap if configured */}
        {capMb && (
          <div className="p-2 rounded-lg bg-slate-900/50 border border-white/5 mb-2 text-[11px]">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> Data Quota
              </span>
              <span className="font-mono text-slate-300">
                {usedMb.toFixed(0)} / {capMb} MB
              </span>
            </div>
            <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${quotaPercent > 90 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                style={{ width: `${quotaPercent}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Gateway & Interface Metadata footer */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
        <span>Gateway: {adapter.gateway || 'None'}</span>
        <span>Link: {adapter.speed_mbps} Mbps</span>
      </div>
    </div>
  );
};
