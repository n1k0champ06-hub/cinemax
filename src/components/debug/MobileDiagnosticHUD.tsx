import React, { useEffect, useState, useRef } from 'react';
import { Bug, X, RefreshCw, Eye, AlertTriangle, Layers, Activity } from 'lucide-react';

interface TouchEventLog {
  timestamp: string;
  type: string;
  targetTag: string;
  targetClass: string;
  pointerEvents: string;
  zIndex: string;
  scrollY: number;
}

export const MobileDiagnosticHUD: React.FC = () => {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('debug') === 'true' || localStorage.getItem('cinemax_debug') === 'true';
  });

  const [isOpen, setIsOpen] = useState(false);
  const [fps, setFps] = useState(60);
  const [bodyClasses, setBodyClasses] = useState('');
  const [topElementInfo, setTopElementInfo] = useState<{
    tag: string;
    className: string;
    pointerEvents: string;
    zIndex: string;
    position: string;
  } | null>(null);
  const [touchLogs, setTouchLogs] = useState<TouchEventLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<string[]>([]);
  const [erudaLoaded, setErudaLoaded] = useState(false);

  const fpsFrameCount = useRef(0);
  const fpsLastTime = useRef(performance.now());

  // FPS Monitor
  useEffect(() => {
    if (!enabled) return;

    let animId: number;
    const calcFps = () => {
      fpsFrameCount.current++;
      const now = performance.now();
      if (now - fpsLastTime.current >= 1000) {
        setFps(Math.round((fpsFrameCount.current * 1000) / (now - fpsLastTime.current)));
        fpsFrameCount.current = 0;
        fpsLastTime.current = now;
      }
      animId = requestAnimationFrame(calcFps);
    };

    animId = requestAnimationFrame(calcFps);
    return () => cancelAnimationFrame(animId);
  }, [enabled]);

  // Document State Inspector & Touch Listener
  useEffect(() => {
    if (!enabled) return;

    const updateState = () => {
      setBodyClasses(document.body.className);

      // Check element at screen center
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const el = document.elementFromPoint(cx, cy);
      if (el) {
        const style = window.getComputedStyle(el);
        setTopElementInfo({
          tag: el.tagName.toLowerCase(),
          className: el.className ? String(el.className).substring(0, 40) : '',
          pointerEvents: style.pointerEvents,
          zIndex: style.zIndex,
          position: style.position,
        });
      }
    };

    const interval = setInterval(updateState, 500);

    // Track touch events
    const handleTouch = (e: TouchEvent) => {
      const touch = e.touches[0] || e.changedTouches[0];
      if (!touch) return;

      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const style = target ? window.getComputedStyle(target) : null;
      const now = new Date();
      const timestamp = `${now.getSeconds()}.${String(now.getMilliseconds()).padStart(3, '0')}`;

      const log: TouchEventLog = {
        timestamp,
        type: e.type,
        targetTag: target ? target.tagName.toLowerCase() : 'unknown',
        targetClass: target && target.className ? String(target.className).substring(0, 30) : '',
        pointerEvents: style ? style.pointerEvents : 'unknown',
        zIndex: style ? style.zIndex : 'auto',
        scrollY: Math.round(window.scrollY),
      };

      setTouchLogs((prev) => [log, ...prev].slice(0, 15));
    };

    // Track JS errors
    const handleError = (event: ErrorEvent) => {
      setErrorLogs((prev) => [`[ERR] ${event.message} (${event.filename}:${event.lineno})`, ...prev].slice(0, 10));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setErrorLogs((prev) => [`[REJECT] ${String(event.reason)}`, ...prev].slice(0, 10));
    };

    window.addEventListener('touchstart', handleTouch, { passive: true });
    window.addEventListener('touchmove', handleTouch, { passive: true });
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      clearInterval(interval);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [enabled]);

  // Load Eruda DevTools
  const loadEruda = () => {
    if (erudaLoaded || (window as any).eruda) {
      (window as any).eruda?.show();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.onload = () => {
      (window as any).eruda?.init();
      (window as any).eruda?.show();
      setErudaLoaded(true);
    };
    document.body.appendChild(script);
  };

  const toggleEnable = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem('cinemax_debug', next ? 'true' : 'false');
  };

  if (!enabled) {
    return (
      <button
        onClick={toggleEnable}
        className="fixed bottom-24 right-3 z-[999999] opacity-40 hover:opacity-100 bg-black/80 text-yellow-400 p-2 rounded-full border border-yellow-500/30 text-[10px] font-mono backdrop-blur-md shadow-lg transition-all"
        title="Bật Debug HUD"
      >
        <Bug size={14} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-16 right-3 z-[999999] font-mono text-[11px] select-none text-white">
      {!isOpen ? (
        <div className="flex items-center gap-1.5 bg-black/90 border border-yellow-500/50 rounded-full px-3 py-1.5 backdrop-blur-md shadow-2xl">
          <span className={`w-2 h-2 rounded-full ${fps < 30 ? 'bg-red-500 animate-ping' : 'bg-green-400'}`} />
          <span className="font-bold text-yellow-400">{fps} FPS</span>
          <span className="text-gray-400">|</span>
          <span className={bodyClasses.includes('overflow-hidden') ? 'text-red-400 font-bold' : 'text-green-400'}>
            {bodyClasses.includes('overflow-hidden') ? 'LOCKED' : 'SCROLLABLE'}
          </span>
          <button
            onClick={() => setIsOpen(true)}
            className="ml-1 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 px-2 py-0.5 rounded text-[10px]"
          >
            HUD
          </button>
          <button onClick={toggleEnable} className="text-gray-400 hover:text-white p-0.5">
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="w-[320px] max-h-[70vh] bg-black/95 border border-yellow-500/40 rounded-xl p-3 shadow-2xl flex flex-col gap-2 backdrop-blur-xl overflow-hidden text-left">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2 font-bold text-yellow-400">
              <Activity size={14} />
              <span>DEBUG HUD (SONY/MOBILE)</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={loadEruda}
                className="bg-blue-600 hover:bg-blue-500 text-white text-[9px] px-2 py-0.5 rounded font-bold"
              >
                DevTools
              </button>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white p-1">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Core Telemetry */}
          <div className="grid grid-cols-2 gap-1.5 bg-white/5 p-2 rounded-lg text-[10px]">
            <div>
              <span className="text-gray-400">Main Thread FPS:</span>{' '}
              <strong className={fps < 30 ? 'text-red-400 font-bold' : 'text-green-400'}>{fps}</strong>
            </div>
            <div>
              <span className="text-gray-400">Body Overflow:</span>{' '}
              <strong className={bodyClasses.includes('overflow-hidden') ? 'text-red-400 font-bold' : 'text-green-400'}>
                {bodyClasses.includes('overflow-hidden') ? 'HIDDEN' : 'AUTO'}
              </strong>
            </div>
          </div>

          {/* Top Element at Screen Center */}
          <div className="bg-white/5 p-2 rounded-lg text-[10px] space-y-0.5">
            <div className="text-yellow-400 font-bold flex items-center gap-1">
              <Layers size={10} />
              <span>Element at Screen Center:</span>
            </div>
            {topElementInfo ? (
              <div className="text-gray-300 space-y-0.5 pl-1">
                <div>Tag: <span className="text-blue-300 font-bold">&lt;{topElementInfo.tag}&gt;</span></div>
                <div className="truncate">Class: <span className="text-gray-400">{topElementInfo.className || 'none'}</span></div>
                <div>PointerEvents: <span className="text-purple-300">{topElementInfo.pointerEvents}</span> | ZIndex: <span className="text-orange-300">{topElementInfo.zIndex}</span></div>
              </div>
            ) : (
              <span className="text-gray-500">None detected</span>
            )}
          </div>

          {/* Error Logs */}
          {errorLogs.length > 0 && (
            <div className="bg-red-950/60 border border-red-500/30 p-2 rounded-lg text-[9px] space-y-1">
              <div className="text-red-400 font-bold flex items-center gap-1">
                <AlertTriangle size={10} />
                <span>JS Errors / Crashes ({errorLogs.length})</span>
              </div>
              <div className="max-h-[60px] overflow-y-auto space-y-1 text-red-200">
                {errorLogs.map((err, i) => (
                  <div key={i} className="break-all">{err}</div>
                ))}
              </div>
            </div>
          )}

          {/* Touch Logs */}
          <div className="flex-1 min-h-0 flex flex-col gap-1 bg-white/5 p-2 rounded-lg text-[9px]">
            <div className="text-gray-400 font-bold flex items-center justify-between">
              <span>Realtime Touch Log (Top 15):</span>
              <button onClick={() => setTouchLogs([])} className="text-gray-500 hover:text-white">Clear</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 max-h-[120px] text-gray-300">
              {touchLogs.length === 0 ? (
                <div className="text-gray-600 italic">Chưa có thao tác chạm/vuốt</div>
              ) : (
                touchLogs.map((t, idx) => (
                  <div key={idx} className="border-b border-white/5 pb-0.5">
                    <span className="text-yellow-400">[{t.timestamp}]</span>{' '}
                    <span className="text-green-300">{t.type}</span> on{' '}
                    <span className="text-blue-300">&lt;{t.targetTag}&gt;</span>{' '}
                    {t.targetClass && <span className="text-gray-400">({t.targetClass})</span>}{' '}
                    <span className="text-purple-300">[pe:{t.pointerEvents}]</span>{' '}
                    <span className="text-orange-300">[z:{t.zIndex}]</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
