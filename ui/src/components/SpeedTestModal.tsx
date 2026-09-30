import React, { useState } from 'react';
import { X, Play, RefreshCw, Gauge, ArrowDownRight, ArrowUpRight, CheckCircle2, Zap } from 'lucide-react';
import { SpeedTestResult } from '../types';

interface SpeedTestModalProps {
  onClose: () => void;
  onRunSpeedTest: () => Promise<SpeedTestResult[]>;
}

export const SpeedTestModal: React.FC<SpeedTestModalProps> = ({
  onClose,
  onRunSpeedTest
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SpeedTestResult[] | null>(null);

  const startTest = async () => {
    setIsRunning(true);
    setResults(null);
    try {
      const data = await onRunSpeedTest();
      setResults(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  const aggregateResult = results?.find(r => r.interface_id === 'bonded_aggregate');
  const adapterResults = results?.filter(r => r.interface_id !== 'bonded_aggregate') || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 relative border border-white/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-2">
            <Gauge className="w-3.5 h-3.5" /> Benchmarking Tool
          </div>
          <h2 className="text-xl font-bold text-white">Multi-WAN Speed & Aggregation Benchmark</h2>
          <p className="text-xs text-slate-400 mt-1">
            Tests every physical connection independently and verifies combined multi-path bonding throughput.
          </p>
        </div>

        {/* Big Action / Result Banner */}
        {aggregateResult ? (
          <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-cyan-900/40 border border-indigo-500/30 mb-6 text-center">
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              Bonded Aggregated Total
            </span>
            <div className="text-4xl font-extrabold font-mono text-white mt-1 mb-2">
              {aggregateResult.download_mbps.toFixed(1)} <span className="text-lg text-slate-300">Mbps</span>
            </div>
            <div className="flex items-center justify-center gap-6 text-xs text-slate-300">
              <span className="flex items-center gap-1 text-indigo-300">
                <ArrowUpRight className="w-4 h-4" /> Upload: {aggregateResult.upload_mbps.toFixed(1)} Mbps
              </span>
              <span className="flex items-center gap-1 text-emerald-300">
                <Zap className="w-4 h-4" /> Ping: {aggregateResult.latency_ms.toFixed(0)} ms
              </span>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-white/5 mb-6 flex flex-col items-center justify-center text-center">
            <Gauge className="w-12 h-12 text-slate-500 mb-3" />
            <h3 className="text-sm font-semibold text-slate-200 mb-1">
              Ready to Benchmark All Interfaces
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Press Start to measure throughput across all active adapters and calculate aggregation efficiency.
            </p>
          </div>
        )}

        {/* Per Adapter Results Breakdown */}
        {adapterResults.length > 0 && (
          <div className="mb-6 space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Per-Adapter Breakdown
            </h4>
            {adapterResults.map(r => (
              <div
                key={r.interface_id}
                className="p-3 rounded-xl bg-slate-900/50 border border-white/5 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-white">{r.interface_name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Ping: {r.latency_ms.toFixed(0)} ms</div>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-cyan-400 font-semibold">
                    ↓ {r.download_mbps.toFixed(1)} Mbps
                  </span>
                  <span className="text-indigo-400 font-semibold">
                    ↑ {r.upload_mbps.toFixed(1)} Mbps
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            onClick={startTest}
            disabled={isRunning}
            className={`px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2 ${
              isRunning ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Testing Interfaces...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Start Benchmark</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
