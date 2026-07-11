import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Trash2, Copy, ChevronsUpDown, ShieldAlert, Wifi, Monitor, Play, Cpu, Minimize2, Maximize2, Puzzle
} from 'lucide-react';
import { godModeStore, GodModeLog } from '../../lib/godmode';

type FilterType = 'all' | 'edge-ai' | 'player' | 'network' | 'extension' | 'errors';

export const GodModeConsole: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<GodModeLog[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [height, setHeight] = useState(300); // in pixels
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const consoleRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // Subscribe to godModeStore
  useEffect(() => {
    const unsubOpen = godModeStore.subscribeIsOpen(setIsOpen);
    const unsubLogs = godModeStore.subscribe(setLogs);

    return () => {
      unsubOpen();
      unsubLogs();
    };
  }, []);

  // Handle auto-scroll to bottom
  useEffect(() => {
    if (shouldAutoScrollRef.current && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, isOpen, isMinimized]);

  // Track if user has scrolled up
  const handleScroll = () => {
    const container = logsContainerRef.current;
    if (!container) return;

    // Threshold of 30px from bottom to trigger auto-scroll
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 30;
    shouldAutoScrollRef.current = isAtBottom;
  };

  // Drag resizing handler
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newHeight = window.innerHeight - e.clientY;
      // Clamping between 120px and 80% of window height
      if (newHeight >= 120 && newHeight <= window.innerHeight * 0.8) {
        setHeight(newHeight);
        setIsMinimized(false);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Filter logic
  const filteredLogs = logs.filter((log) => {
    if (activeFilter === 'errors') {
      return log.level === 'ERROR';
    }
    if (activeFilter === 'edge-ai') {
      return log.category === 'EDGE_WORKER' || log.category === 'GEMINI_AI';
    }
    if (activeFilter === 'player') {
      return log.category === 'PLAYER';
    }
    if (activeFilter === 'network') {
      return log.category === 'NETWORK';
    }
    if (activeFilter === 'extension') {
      return log.category === 'EXTENSION';
    }
    return true; // 'all'
  });

  const handleCopyAll = () => {
    const formatted = logs
      .map(
        (log) =>
          `[${log.timestamp}] ${log.category.padEnd(13)} [${log.level.padEnd(5)}] ${log.message}${
            log.metric ? ` (${log.metric})` : ''
          }`
      )
      .join('\n');

    navigator.clipboard.writeText(formatted);
    
    // Temporarily log that copy succeeded
    godModeStore.addLog('SYSTEM', 'INFO', 'All logs copied to clipboard.');
  };

  const handleClearLogs = () => {
    godModeStore.clear();
    godModeStore.addLog('SYSTEM', 'INFO', 'Console logs cleared.');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={consoleRef}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{ height: isMinimized ? '36px' : `${height}px` }}
        className="fixed bottom-0 left-0 right-0 z-[99999] bg-[#1a1a1a] border-t border-zinc-800 flex flex-col font-mono text-xs shadow-2xl select-text"
      >
        {/* Resize Handler Handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`absolute top-0 left-0 right-0 h-1 cursor-ns-resize z-50 transition-colors ${
            isDragging ? 'bg-red-500' : 'bg-transparent hover:bg-red-500/50'
          }`}
        />

        {/* Console Header / Action Bar */}
        <div className="h-9 px-3 bg-[#111] border-b border-zinc-800 flex items-center justify-between select-none shrink-0 text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="text-red-500 font-bold tracking-widest text-[10px] uppercase flex items-center gap-1.5 animate-pulse">
              <ShieldAlert size={12} />
              God-Mode Console
            </span>
            <div className="h-3 w-px bg-zinc-800" />
            
            {/* Filter Toggle Buttons */}
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: 'All', icon: <Monitor size={10} /> },
                  { id: 'edge-ai', label: 'Edge/AI', icon: <Cpu size={10} /> },
                  { id: 'player', label: 'Player', icon: <Play size={10} /> },
                  { id: 'network', label: 'Network', icon: <Wifi size={10} /> },
                  { id: 'extension', label: 'Extension', icon: <Puzzle size={10} /> },
                  { id: 'errors', label: 'Errors Only', icon: <ShieldAlert size={10} /> },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setActiveFilter(f.id);
                    shouldAutoScrollRef.current = true;
                  }}
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    activeFilter === f.id
                      ? 'bg-zinc-800 text-white border border-zinc-700'
                      : 'hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-transparent'
                  }`}
                >
                  {f.icon}
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              title="Copy All Logs"
              className="p-1.5 hover:bg-zinc-800 hover:text-white rounded transition-colors cursor-pointer"
            >
              <Copy size={13} />
            </button>
            <button
              onClick={handleClearLogs}
              title="Clear Console"
              className="p-1.5 hover:bg-zinc-800 hover:text-white rounded transition-colors text-red-400 hover:text-red-300 cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
            <div className="h-3 w-px bg-zinc-800" />
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? 'Restore Console' : 'Minimize Console'}
              className="p-1.5 hover:bg-zinc-800 hover:text-white rounded transition-colors cursor-pointer"
            >
              {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            </button>
            <button
              onClick={() => godModeStore.setIsOpen(false)}
              title="Close Console"
              className="p-1.5 hover:bg-red-950 hover:text-red-300 rounded transition-colors text-zinc-500 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Console Body Logs Stream */}
        {!isMinimized && (
          <div
            ref={logsContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 bg-[#181818] text-[#e5e5e5] selection:bg-red-500/20 custom-scrollbar scroll-smooth"
          >
            {filteredLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-600 italic select-none">
                No logs recorded matching this filter.
              </div>
            ) : (
              filteredLogs.map((log) => {
                // Color mapping for Category tags
                const catColors: Record<GodModeLog['category'], string> = {
                  EDGE_WORKER: 'text-indigo-400 bg-indigo-950/40 border-indigo-900/50',
                  GEMINI_AI: 'text-purple-400 bg-purple-950/40 border-purple-900/50',
                  PLAYER: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/50',
                  NETWORK: 'text-sky-400 bg-sky-950/40 border-sky-900/50',
                  SYSTEM: 'text-amber-400 bg-amber-950/40 border-amber-900/50',
                  EXTENSION: 'text-cyan-400 bg-cyan-950/40 border-cyan-900/50',
                };

                // Level colors
                const lvlColors = {
                  INFO: 'text-zinc-300',
                  WARN: 'text-yellow-500 font-semibold',
                  ERROR: 'text-red-500 font-bold bg-red-950/10 px-1 rounded',
                };

                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-2 hover:bg-zinc-800/40 py-0.5 px-1 rounded transition-colors leading-relaxed ${
                      lvlColors[log.level]
                    }`}
                  >
                    {/* Timestamp */}
                    <span className="text-zinc-600 select-none shrink-0 font-normal">
                      {log.timestamp}
                    </span>

                    {/* Category Tag */}
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded border leading-none font-semibold shrink-0 uppercase tracking-wider select-none ${
                        catColors[log.category] || 'text-zinc-400 bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      {log.category.replace('_', ' ')}
                    </span>

                    {/* Message content */}
                    <span className="flex-1 break-all whitespace-pre-wrap">
                      {log.message}
                    </span>

                    {/* Metric indicator if any */}
                    {log.metric && (
                      <span className="text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 select-none shrink-0 font-medium font-sans">
                        {log.metric}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
export default GodModeConsole;
