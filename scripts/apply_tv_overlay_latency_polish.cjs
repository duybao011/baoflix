const fs = require('fs');
const path = require('path');

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, 'utf8');
  console.log(`patched ${rel}`);
}

function replaceOnce(content, from, to, label) {
  if (!content.includes(from)) {
    throw new Error(`Missing pattern: ${label}`);
  }
  return content.replace(from, to);
}

function patchTvWatchOverlay() {
  const rel = 'components/TvWatchOverlay.tsx';
  let content = read(rel);

  content = replaceOnce(
    content,
    'type OverlayCommandDetail = {\n  action: "peek" | "hide" | "open-episodes" | "open-sources" | "close-panel" | "activity";\n  focus?: boolean;\n};',
    'type OverlayCommandDetail = {\n  action: "peek" | "hide" | "open-episodes" | "open-sources" | "close-panel" | "activity";\n  focus?: boolean;\n  duration?: number;\n};',
    'OverlayCommandDetail duration'
  );

  content = replaceOnce(
    content,
    'const AUTO_HIDE_MS = 3400;\nconst SEEK_SECONDS = 10;',
    'const AUTO_HIDE_MS = 2100;\nconst INITIAL_PEEK_MS = 1500;\nconst QUICK_ACTION_PEEK_MS = 1150;\nconst PANEL_RETURN_PEEK_MS = 1700;\nconst SEEK_SECONDS = 10;',
    'overlay timing constants'
  );

  content = replaceOnce(
    content,
    `function focusElement(selector: string) {\n  window.setTimeout(() => {\n    const target = document.querySelector<HTMLElement>(selector);\n\n    if (!target) return;\n\n    target.focus({ preventScroll: true });\n    target.scrollIntoView({\n      behavior: "smooth",\n      block: "nearest",\n      inline: "center",\n    });\n  }, 60);\n}`,
    `function runSoon(callback: () => void) {\n  if (typeof window.requestAnimationFrame === "function") {\n    window.requestAnimationFrame(() => {\n      window.requestAnimationFrame(callback);\n    });\n    return;\n  }\n\n  window.setTimeout(callback, 16);\n}\n\nfunction focusElement(selector: string) {\n  runSoon(() => {\n    const target = document.querySelector<HTMLElement>(selector);\n\n    if (!target) return;\n\n    target.focus({ preventScroll: true });\n    target.scrollIntoView({\n      behavior: "auto",\n      block: "nearest",\n      inline: "center",\n    });\n  });\n}`,
    'focusElement rAF'
  );

  content = replaceOnce(
    content,
    `  function scheduleHide() {\n    clearHideTimer();\n\n    hideTimerRef.current = window.setTimeout(() => {\n      if (overlayModeRef.current !== "peek" || overlayPanelRef.current) {\n        hideTimerRef.current = null;\n        return;\n      }\n\n      hideOverlay({ focusPlayer: true });\n      hideTimerRef.current = null;\n    }, AUTO_HIDE_MS);\n  }\n\n  function showPeek({ focus = false }: { focus?: boolean } = {}) {\n    setOverlayPanel(null);\n    setOverlayMode("peek");\n    scheduleHide();\n\n    if (focus) {\n      focusOverlayDefault();\n    }\n  }`,
    `  function scheduleHide(delay = AUTO_HIDE_MS) {\n    clearHideTimer();\n\n    hideTimerRef.current = window.setTimeout(() => {\n      if (overlayModeRef.current !== "peek" || overlayPanelRef.current) {\n        hideTimerRef.current = null;\n        return;\n      }\n\n      hideOverlay({ focusPlayer: true });\n      hideTimerRef.current = null;\n    }, delay);\n  }\n\n  function showPeek({\n    focus = false,\n    hideAfter = AUTO_HIDE_MS,\n  }: { focus?: boolean; hideAfter?: number } = {}) {\n    setOverlayPanel(null);\n    setOverlayMode("peek");\n    scheduleHide(hideAfter);\n\n    if (focus) {\n      focusOverlayDefault();\n    }\n  }`,
    'scheduleHide showPeek duration'
  );

  content = replaceOnce(
    content,
    '      showPeek({ focus: true });',
    '      showPeek({ focus: true, hideAfter: PANEL_RETURN_PEEK_MS });',
    'closePanel showPeek duration'
  );

  content = replaceOnce(
    content,
    `  function handleSeek(direction: "backward" | "forward") {\n    showPeek({ focus: false });\n    dispatchPlayerCommand(\n      "seek",\n      direction === "forward" ? SEEK_SECONDS : -SEEK_SECONDS\n    );\n  }\n\n  function handleTogglePlay() {\n    showPeek({ focus: false });\n    dispatchPlayerCommand("toggle-play");\n  }`,
    `  function handleSeek(direction: "backward" | "forward") {\n    dispatchPlayerCommand(\n      "seek",\n      direction === "forward" ? SEEK_SECONDS : -SEEK_SECONDS\n    );\n    showPeek({ focus: false, hideAfter: QUICK_ACTION_PEEK_MS });\n  }\n\n  function handleTogglePlay() {\n    dispatchPlayerCommand("toggle-play");\n    showPeek({ focus: false, hideAfter: QUICK_ACTION_PEEK_MS });\n  }`,
    'instant action before overlay'
  );

  content = replaceOnce(
    content,
    '    showPeek({ focus: false });',
    '    showPeek({ focus: false, hideAfter: INITIAL_PEEK_MS });',
    'initial showPeek duration'
  );

  // The previous replacement only changes the first occurrence; tune episode/source reload too.
  content = content.replace(
    '    showPeek({ focus: false });\n  }, [safeEpisodeIndex, currentServer?.server_name]);',
    '    showPeek({ focus: false, hideAfter: INITIAL_PEEK_MS });\n  }, [safeEpisodeIndex, currentServer?.server_name]);'
  );

  content = replaceOnce(
    content,
    '        showPeek({ focus: detail.focus !== false });',
    '        showPeek({ focus: detail.focus !== false, hideAfter: detail.duration ?? AUTO_HIDE_MS });',
    'wake overlay duration'
  );

  content = replaceOnce(
    content,
    '          showPeek({ focus: Boolean(detail.focus) });',
    '          showPeek({ focus: Boolean(detail.focus), hideAfter: detail.duration ?? AUTO_HIDE_MS });',
    'command peek duration'
  );

  content = replaceOnce(
    content,
    '      }, 1800);',
    '      }, 1100);',
    'native hint shorter'
  );

  content = replaceOnce(
    content,
    '        "pointer-events-none absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-200",',
    '        "pointer-events-none absolute inset-0 z-30 flex flex-col justify-between will-change-opacity transition-opacity duration-100 ease-out",',
    'overlay fade duration'
  );

  write(rel, content);
}

function patchFullscreenPlayerBox() {
  const rel = 'components/FullscreenPlayerBox.tsx';
  let content = read(rel);

  content = replaceOnce(
    content,
    `  const focusPlayerSurface = useCallback(() => {\n    const box = boxRef.current;\n\n    if (!box) return;\n\n    window.setTimeout(() => {\n      try {\n        const active = document.activeElement;\n\n        if (active instanceof HTMLElement && active !== box && box.contains(active)) {\n          active.blur();\n        }\n\n        box.focus({ preventScroll: true });\n      } catch {\n        // Ignore focus errors in WebView.\n      }\n    }, 30);\n  }, []);`,
    `  const focusPlayerSurface = useCallback(() => {\n    const box = boxRef.current;\n\n    if (!box) return;\n\n    const run = () => {\n      try {\n        const active = document.activeElement;\n\n        if (active instanceof HTMLElement && active !== box && box.contains(active)) {\n          active.blur();\n        }\n\n        box.focus({ preventScroll: true });\n      } catch {\n        // Ignore focus errors in WebView.\n      }\n    };\n\n    if (typeof window.requestAnimationFrame === "function") {\n      window.requestAnimationFrame(run);\n    } else {\n      window.setTimeout(run, 16);\n    }\n  }, []);`,
    'focusPlayerSurface rAF'
  );

  content = replaceOnce(
    content,
    '      }, 620);',
    '      }, 520);',
    'hud timer shorter'
  );

  content = replaceOnce(
    content,
    `      window.setTimeout(() => {\n        if (detail.handled) return;\n\n        detail.handled = true;\n        focusPlayerSurface();\n\n        if (detail.action !== "focus-player") {\n          emitNativeMissing();\n\n          if (detail.action === "seek") {\n            emitHud({\n              type: "seek",\n              delta: detail.seconds || 0,\n            });\n          }\n        }\n      }, 0);`,
    `      const runFallback = () => {\n        if (detail.handled) return;\n\n        detail.handled = true;\n        focusPlayerSurface();\n\n        if (detail.action !== "focus-player") {\n          emitNativeMissing();\n\n          if (detail.action === "seek") {\n            emitHud({\n              type: "seek",\n              delta: detail.seconds || 0,\n            });\n          }\n        }\n      };\n\n      if (typeof queueMicrotask === "function") {\n        queueMicrotask(runFallback);\n      } else {\n        Promise.resolve().then(runFallback);\n      }`,
    'command fallback microtask'
  );

  content = replaceOnce(
    content,
    '        "baoflix-fullscreen-player bg-black outline-none transition-all duration-300",',
    '        "baoflix-fullscreen-player bg-black outline-none transition-[opacity,transform] duration-100 ease-out",',
    'player box transition'
  );

  content = replaceOnce(
    content,
    '          "baoflix-fullscreen-inner bg-black transition-all duration-300",',
    '          "baoflix-fullscreen-inner bg-black transition-[opacity,transform] duration-100 ease-out",',
    'player inner transition'
  );

  content = replaceOnce(
    content,
    '        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black/60 px-4 py-2 text-center text-white shadow-xl backdrop-blur">',
    '        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black/58 px-4 py-2 text-center text-white shadow-xl backdrop-blur will-change-opacity">',
    'hud will-change'
  );

  write(rel, content);
}


function patchTvRemoteNavigator() {
  const rel = 'components/TvRemoteNavigator.tsx';
  let content = read(rel);

  content = replaceOnce(
    content,
    'const SEEK_SECONDS = 10;\nconst FOCUS_MEMORY_PREFIX = "baoflix_tv_focus:";',
    'const SEEK_SECONDS = 10;\nconst OVERLAY_CONTROL_PEEK_MS = 2100;\nconst OVERLAY_ACTION_PEEK_MS = 1150;\nconst OVERLAY_PLAY_PAUSE_PEEK_MS = 1350;\nconst FOCUS_MEMORY_PREFIX = "baoflix_tv_focus:";',
    'remote overlay timing constants'
  );

  content = replaceOnce(
    content,
    'function dispatchOverlayCommand(action: OverlayCommandAction, options?: { focus?: boolean }) {\n  window.dispatchEvent(\n    new CustomEvent("baoflix-tv-overlay-command", {\n      detail: {\n        action,\n        focus: options?.focus,\n      },\n    })\n  );\n}',
    'function dispatchOverlayCommand(\n  action: OverlayCommandAction,\n  options?: { focus?: boolean; duration?: number }\n) {\n  window.dispatchEvent(\n    new CustomEvent("baoflix-tv-overlay-command", {\n      detail: {\n        action,\n        focus: options?.focus,\n        duration: options?.duration,\n      },\n    })\n  );\n}',
    'remote dispatchOverlayCommand duration'
  );

  content = replaceOnce(
    content,
    '  window.setTimeout(() => {\n    const overlay = getVisibleWatchOverlay();\n\n    if (!overlay) return;\n\n    const target = getOverlaySeekFocusable(overlay, direction);\n\n    if (!target) return;\n\n    focusElement(target, pathname);\n  }, 60);',
    '  const run = () => {\n    const overlay = getVisibleWatchOverlay();\n\n    if (!overlay) return;\n\n    const target = getOverlaySeekFocusable(overlay, direction);\n\n    if (!target) return;\n\n    focusElement(target, pathname);\n  };\n\n  if (typeof window.requestAnimationFrame === "function") {\n    window.requestAnimationFrame(run);\n  } else {\n    window.setTimeout(run, 16);\n  }',
    'remote seek focus rAF'
  );

  content = replaceOnce(
    content,
    '    dispatchPlayerCommand("toggle-play");\n    dispatchOverlayCommand("peek", { focus: false });\n    return true;\n  }\n\n  dispatchPlayerCommand("seek", wantsForward ? SEEK_SECONDS : -SEEK_SECONDS);\n  dispatchOverlayCommand("peek", { focus: false });\n  return true;',
    '    dispatchPlayerCommand("toggle-play");\n    dispatchOverlayCommand("peek", {\n      focus: false,\n      duration: OVERLAY_PLAY_PAUSE_PEEK_MS,\n    });\n    return true;\n  }\n\n  dispatchPlayerCommand("seek", wantsForward ? SEEK_SECONDS : -SEEK_SECONDS);\n  dispatchOverlayCommand("peek", { focus: false, duration: OVERLAY_ACTION_PEEK_MS });\n  return true;',
    'remote playback shortcut durations'
  );

  content = content.replaceAll(
    'dispatchOverlayCommand("peek", { focus: true });',
    'dispatchOverlayCommand("peek", { focus: true, duration: OVERLAY_CONTROL_PEEK_MS });'
  );

  content = content.replaceAll(
    'dispatchOverlayCommand("peek", { focus: false });',
    'dispatchOverlayCommand("peek", { focus: false, duration: OVERLAY_ACTION_PEEK_MS });'
  );

  content = content.replaceAll(
    'dispatchOverlayCommand("peek", {\n      focus: false,\n      duration: OVERLAY_ACTION_PEEK_MS,\n    });',
    'dispatchOverlayCommand("peek", {\n      focus: false,\n      duration: OVERLAY_ACTION_PEEK_MS,\n    });'
  );

  // Play/pause should stay a hair longer than seek so the user can read the state.
  content = content.replace(
    'dispatchPlayerCommand("toggle-play");\n          dispatchOverlayCommand("peek", { focus: false, duration: OVERLAY_ACTION_PEEK_MS });',
    'dispatchPlayerCommand("toggle-play");\n          dispatchOverlayCommand("peek", {\n            focus: false,\n            duration: OVERLAY_PLAY_PAUSE_PEEK_MS,\n          });'
  );

  write(rel, content);
}

try {
  patchTvWatchOverlay();
  patchFullscreenPlayerBox();
  patchTvRemoteNavigator();
  console.log('TV overlay latency polish patch applied.');
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
