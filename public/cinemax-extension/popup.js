// popup.js - Cinemax Subtitle Sync Extension Popup

document.addEventListener('DOMContentLoaded', () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const timeDisplay = document.getElementById('timeDisplay');
  const btnPlay = document.getElementById('btnPlay');
  const playIcon = document.getElementById('playIcon');
  const playText = document.getElementById('playText');
  
  const btnSubMinus1 = document.getElementById('btnSubMinus1');
  const btnSubMinus05 = document.getElementById('btnSubMinus05');
  const btnSubPlus05 = document.getElementById('btnSubPlus05');
  const btnSubPlus1 = document.getElementById('btnSubPlus1');
  const btnReset = document.getElementById('btnReset');
  
  const txtOffset = document.getElementById('txtOffset');
  const btnApplyOffset = document.getElementById('btnApplyOffset');

  let activeTabId = null;
  let lastState = {
    currentTime: 0,
    isPlaying: false,
    duration: 0,
    subtitleOffset: 0
  };

  // Telemetry helper
  function logToPage(level, message) {
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, {
        action: 'popupTelemetry',
        level: level,
        message: `[Extension Popup] ${message}`
      }, () => {
        const err = chrome.runtime.lastError; // Suppress potential error logs
      });
    }
  }

  // Helper to query active tab with fallback
  function getActiveTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        callback(tabs[0]);
      } else {
        // Fallback for popup inspect window or window focus changes
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
          if (tabs && tabs[0]) {
            callback(tabs[0]);
          } else {
            showDisconnected();
          }
        });
      }
    });
  }

  // 1. Get active tab and request initial status
  getActiveTab((tab) => {
    activeTabId = tab.id;
    logToPage('info', 'Popup loaded, active tab detected: ID=' + activeTabId + ', Title="' + (tab.title || '') + '"');
    
    // Send query message to content script
    chrome.tabs.sendMessage(activeTabId, { action: 'popupQueryStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        logToPage('warn', 'Initial status query failed: ' + chrome.runtime.lastError.message);
        showDisconnected();
      } else {
        logToPage('info', 'Initial status query responded successfully: ' + JSON.stringify(response));
      }
    });
  });

  // 2. Poll status as fallback every 1s when popup is open
  const pollInterval = setInterval(() => {
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { action: 'popupQueryStatus' }, () => {
        if (chrome.runtime.lastError) {
          logToPage('warn', 'Polling status query failed: ' + chrome.runtime.lastError.message);
          showDisconnected();
        }
      });
    }
  }, 1000);

  // 3. Listen to state updates from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.source === 'cinemax-extension-content') {
      logToPage('info', `Received status update: event="${message.event || ''}", isPlaying=${message.isPlaying}, currentTime=${message.currentTime !== undefined ? message.currentTime.toFixed(1) + 's' : 'N/A'}`);
      showConnected(message);
    }
  });

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds === null) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    const mStr = String(m).padStart(2, '0');
    const sStr = String(s).padStart(2, '0');
    
    if (h > 0) {
      return `${h}:${mStr}:${sStr}`;
    }
    return `${mStr}:${sStr}`;
  }

  function showConnected(state) {
    document.body.classList.add('is-connected');
    statusIndicator.className = 'indicator connected';
    
    // Save state
    lastState.currentTime = state.currentTime;
    lastState.isPlaying = state.isPlaying;
    lastState.subtitleOffset = state.subtitleOffset;
    if (state.duration > 0) {
      lastState.duration = state.duration;
    }
    
    const offsetSecs = (lastState.subtitleOffset || 0) / 1000;
    const offsetStr = offsetSecs === 0 ? 'Khớp' : `${offsetSecs > 0 ? '+' : ''}${offsetSecs.toFixed(1)}s`;
    
    statusText.innerText = `Đang đồng bộ (Lệch: ${offsetStr})`;
    
    timeDisplay.style.display = 'block';
    timeDisplay.innerText = `${formatTime(lastState.currentTime)} / ${formatTime(lastState.duration)}`;

    if (lastState.isPlaying) {
      playIcon.innerText = '⏸';
      playText.innerText = 'Tạm dừng phim';
    } else {
      playIcon.innerText = '▶';
      playText.innerText = 'Phát phim';
    }
  }

  function showDisconnected() {
    document.body.classList.remove('is-connected');
    statusIndicator.className = 'indicator';
    statusText.innerText = 'Chờ kết nối...';
    timeDisplay.style.display = 'none';
  }

  // --- Button Handlers ---

  function sendCommand(action, data = {}) {
    logToPage('info', `Sending command to active tab: action="${action}", data=${JSON.stringify(data)}`);
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { action, ...data }, () => {
        if (chrome.runtime.lastError) {
          logToPage('warn', `Command "${action}" failed to deliver: ` + chrome.runtime.lastError.message);
        }
      });
    }
  }

  // Play / Pause toggle
  btnPlay.addEventListener('click', () => {
    sendCommand('popupTogglePlay');
  });

  // Subtitle offset adjustment (in seconds)
  btnSubMinus1.addEventListener('click', () => sendCommand('popupAdjustSubtitleOffset', { offset: -1.0 }));
  btnSubMinus05.addEventListener('click', () => sendCommand('popupAdjustSubtitleOffset', { offset: -0.5 }));
  btnSubPlus05.addEventListener('click', () => sendCommand('popupAdjustSubtitleOffset', { offset: 0.5 }));
  btnSubPlus1.addEventListener('click', () => sendCommand('popupAdjustSubtitleOffset', { offset: 1.0 }));

  // Custom offset
  btnApplyOffset.addEventListener('click', () => {
    const val = parseFloat(txtOffset.value);
    if (!isNaN(val)) {
      sendCommand('popupSetSubtitleOffset', { offset: val });
      txtOffset.value = '';
    }
  });

  // Reset offset
  btnReset.addEventListener('click', () => {
    sendCommand('popupSetSubtitleOffset', { offset: 0.0 });
  });

  // Cleanup on close
  window.addEventListener('unload', () => {
    logToPage('info', 'Popup closed by user.');
    clearInterval(pollInterval);
  });
});
