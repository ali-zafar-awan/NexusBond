import React, { useState } from 'react';
import { X, Sparkles, CheckCircle2, Wifi, Smartphone, Network, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { NetworkInterface } from '../types';

interface FirstRunWizardProps {
  interfaces: NetworkInterface[];
  onClose: () => void;
  onComplete: (selectedMode: 'auto' | 'mode_a' | 'mode_b') => void;
}

export const FirstRunWizard: React.FC<FirstRunWizardProps> = ({
  interfaces,
  onClose,
  onComplete
}) => {
  const [step, setStep] = useState<number>(1);
  const [mode, setMode] = useState<'auto' | 'mode_a' | 'mode_b'>('auto');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="glass-panel w-full max-w-xl rounded-3xl p-6 relative border border-white/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Step Counter */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-8 bg-cyan-400'
                  : s < step
                  ? 'w-5 bg-indigo-500'
                  : 'w-5 bg-slate-800'
              }`}
            />
          ))}
          <span className="text-[11px] font-mono text-slate-400 ml-2">Step {step} of 3</span>
        </div>

        {/* Step 1: Interface Discovery */}
        {step === 1 && (
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Getting Started
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Detect Your Internet Connections</h2>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              NexusBond aggregates multiple active network adapters. Plug in your mobile phone via USB tethering or connect Ethernet to start bonding.
            </p>

            <div className="space-y-2.5 mb-6">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Currently Discovered ({interfaces.length}):
              </div>
              {interfaces.map((iface) => (
                <div
                  key={iface.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                      {iface.is_wireless ? <Wifi className="w-4 h-4" /> : <Network className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{iface.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{iface.ip_address}</div>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Ready ({iface.speed_mbps} Mbps)
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Mode Selection */}
        {step === 2 && (
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 mb-2">
              <Zap className="w-3.5 h-3.5" /> Bonding Architecture
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Select Default Operating Mode</h2>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              NexusBond can operate 100% locally or tunnel through a self-hosted cloud VPS relay.
            </p>

            <div className="space-y-3 mb-6">
              <div
                onClick={() => setMode('auto')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  mode === 'auto'
                    ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md ring-1 ring-cyan-500'
                    : 'bg-slate-900/40 border-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Auto Mode (Recommended)</span>
                  <CheckCircle2 className={`w-4 h-4 ${mode === 'auto' ? 'text-cyan-400' : 'text-slate-600'}`} />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Dynamically uses VPS Bonding Tunnel if reachable, otherwise automatically falls back to Local Smart Dispatch.
                </p>
              </div>

              <div
                onClick={() => setMode('mode_a')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  mode === 'mode_a'
                    ? 'bg-indigo-500/10 border-indigo-500/50 shadow-md ring-1 ring-indigo-500'
                    : 'bg-slate-900/40 border-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Mode A: Local Smart Dispatch (Zero Cost)</span>
                  <CheckCircle2 className={`w-4 h-4 ${mode === 'mode_a' ? 'text-indigo-400' : 'text-slate-600'}`} />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  100% Local. Aggregates multi-stream downloads, web browsing, and video streaming across all links.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 3 && (
          <div>
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
              <h2 className="text-lg font-bold text-white">NexusBond v2.0 is Ready!</h2>
              <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                Your network links have been configured. You can monitor aggregated throughput and latency directly from the dashboard.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => onComplete(mode)}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 w-full"
              >
                Launch Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
