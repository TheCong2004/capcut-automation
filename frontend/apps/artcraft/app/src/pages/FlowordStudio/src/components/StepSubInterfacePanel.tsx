import React, { useState } from 'react';
import { Monitor, Globe, Zap, Cpu, Check } from 'lucide-react';
import { NeoStep } from './FlowordPipelineVisualizer';

interface StepSubInterfacePanelProps {
  step: NeoStep;
  onSelectFunction: (stepId: string, fnName: string) => void;
  activeDraftUrl: string;
}

export type AutomationDriver = 'playwright' | 'cdp' | 'capcut_native';

export const StepSubInterfacePanel: React.FC<StepSubInterfacePanelProps> = ({
  step,
  onSelectFunction,
  activeDraftUrl,
}) => {
  const [driver, setDriver] = useState<AutomationDriver>('cdp');

  return (
    <div
      style={{ backgroundColor: '#1a1e28', border: '1px solid rgba(255, 255, 255, 0.08)' }}
      className="rounded-2xl p-4 h-full flex flex-col justify-between select-none shadow-md"
    >
      <div>
        {/* Header */}
        <div style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} className="flex items-center justify-between pb-3 mb-3 border-b">
          <div className="flex items-center gap-2.5">
            <span
              style={{ backgroundColor: '#fbbf24', color: '#0f172a' }}
              className="w-7 h-7 rounded-lg font-bold text-xs font-mono flex items-center justify-center"
            >
              #{step.stepNumber}
            </span>
            <div>
              <h3 style={{ color: '#ffffff' }} className="font-bold text-sm">
                {step.title} — Sub-Interface Config
              </h3>
              <p style={{ color: '#cbd5e1' }} className="text-xs">Tùy chọn chức năng & Trình điều khiển tự động</p>
            </div>
          </div>

          <span
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}
            className="px-2.5 py-1 text-xs font-mono rounded-full flex items-center gap-1 font-bold"
          >
            <Monitor className="w-3.5 h-3.5" /> Active Node
          </span>
        </div>

        {/* Function Selection Grid */}
        <div className="mb-4">
          <label style={{ color: '#fef08a' }} className="text-xs font-mono font-bold mb-2 block">
            1. Tùy chọn Chức năng Xử lý (Function Selector):
          </label>

          <div className="grid grid-cols-3 gap-3">
            {step.functions.map((fnName) => {
              const isSelected = (step.selectedFunction || step.functions[0]) === fnName;

              return (
                <div
                  key={fnName}
                  onClick={() => onSelectFunction(step.id, fnName)}
                  style={{
                    backgroundColor: isSelected ? 'rgba(251, 191, 36, 0.15)' : '#232836',
                    border: isSelected ? '1.5px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.08)',
                    color: isSelected ? '#fef08a' : '#e2e8f0',
                  }}
                  className="p-3.5 rounded-xl cursor-pointer transition-all flex flex-col justify-between shadow-sm hover:opacity-90"
                >
                  <div className="flex items-center justify-between mb-1 font-mono text-xs font-bold">
                    <span className="truncate">{fnName}</span>
                    {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0 font-bold" />}
                  </div>
                  <p style={{ color: '#94a3b8' }} className="text-[11px] font-sans">Tự động hóa tác vụ chuyên biệt</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Automation Driver Selection */}
        <div className="mb-4">
          <label style={{ color: '#fef08a' }} className="text-xs font-mono font-bold mb-2 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            2. Trình điều khiển Tự động (Automation Driver):
          </label>

          <div className="grid grid-cols-3 gap-3 font-mono">
            {/* CDP Session */}
            <div
              onClick={() => setDriver('cdp')}
              style={{
                backgroundColor: driver === 'cdp' ? 'rgba(251, 191, 36, 0.15)' : '#232836',
                border: driver === 'cdp' ? '1.5px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.08)',
                color: driver === 'cdp' ? '#fef08a' : '#e2e8f0',
              }}
              className="p-3 rounded-xl cursor-pointer transition-all shadow-sm"
            >
              <div className="flex items-center gap-1.5 text-xs mb-1 font-bold">
                <Zap className="w-4 h-4 text-purple-400" />
                CDP Bridge (:9222)
              </div>
              <p style={{ color: '#94a3b8' }} className="text-[11px] font-sans">Chrome DevTools Protocol</p>
            </div>

            {/* Playwright */}
            <div
              onClick={() => setDriver('playwright')}
              style={{
                backgroundColor: driver === 'playwright' ? 'rgba(251, 191, 36, 0.15)' : '#232836',
                border: driver === 'playwright' ? '1.5px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.08)',
                color: driver === 'playwright' ? '#fef08a' : '#e2e8f0',
              }}
              className="p-3 rounded-xl cursor-pointer transition-all shadow-sm"
            >
              <div className="flex items-center gap-1.5 text-xs mb-1 font-bold">
                <Globe className="w-4 h-4 text-blue-400" />
                Playwright Auto
              </div>
              <p style={{ color: '#94a3b8' }} className="text-[11px] font-sans">Headless Chromium Auto</p>
            </div>

            {/* CapCut Native */}
            <div
              onClick={() => setDriver('capcut_native')}
              style={{
                backgroundColor: driver === 'capcut_native' ? 'rgba(251, 191, 36, 0.15)' : '#232836',
                border: driver === 'capcut_native' ? '1.5px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.08)',
                color: driver === 'capcut_native' ? '#fef08a' : '#e2e8f0',
              }}
              className="p-3 rounded-xl cursor-pointer transition-all shadow-sm"
            >
              <div className="flex items-center gap-1.5 text-xs mb-1 font-bold">
                <Cpu className="w-4 h-4 text-emerald-400" />
                CapCut Agent
              </div>
              <p style={{ color: '#94a3b8' }} className="text-[11px] font-sans">CapCut Local Bridge</p>
            </div>
          </div>
        </div>

        {/* Details Panel */}
        <div style={{ backgroundColor: '#12151e' }} className="p-3 rounded-xl space-y-1.5 font-mono text-xs text-slate-200">
          <div className="flex items-center justify-between">
            <span style={{ color: '#cbd5e1' }}>Driver Connection:</span>
            <span className="text-emerald-300 font-bold">
              {driver === 'cdp' ? 'ws://127.0.0.1:9222 Attached' : driver === 'playwright' ? 'Chromium Headless Ready' : 'CapCut Mate Native Ready'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span style={{ color: '#cbd5e1' }}>Target CapCut Draft:</span>
            <span style={{ color: '#fef08a' }} className="font-bold truncate max-w-[220px]">{activeDraftUrl || '0725 CapCut Win'}</span>
          </div>
        </div>
      </div>

      <div style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} className="pt-3 border-t text-xs font-mono text-slate-300 flex justify-between items-center">
        <span>Signature Verified • Execution Plan v4.2</span>
        <span style={{ color: '#fbbf24' }} className="font-bold cursor-pointer hover:underline">Re-scan CDP Ports</span>
      </div>
    </div>
  );
};
