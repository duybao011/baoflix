const fs = require("fs");
const path = require("path");

const root = process.cwd();
const target = path.join(root, "components", "NativeVideoPlayer.tsx");

if (!fs.existsSync(target)) {
  throw new Error("Không tìm thấy components/NativeVideoPlayer.tsx");
}

let content = fs.readFileSync(target, "utf8");
const before = content;

const oldBlock = `    function restoreProgressIfNeeded() {
      if (restoreDoneRef.current) return;
      restoreDoneRef.current = true;

      const saved = readVideoProgress(progressKey);
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const savedTime = Number(saved?.currentTime || 0);

      if (savedTime > 8 && (!duration || savedTime < duration - 8)) {
        try {
          video.currentTime = savedTime;
        } catch {
          // Some streams reject seek before enough data is buffered.
        }
      }
    }

    function saveProgressNow() {
      if (!progressKey) return;

      const currentTime = video.currentTime || 0;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;

      saveVideoProgress(progressKey, {
        currentTime,
        duration,
        updatedAt: new Date().toISOString(),
        title,
        subtitle,
      });
    }`;

const newBlock = `    function restoreProgressIfNeeded() {
      const currentVideo = videoRef.current;

      if (!currentVideo) return;
      if (restoreDoneRef.current) return;

      restoreDoneRef.current = true;

      const saved = readVideoProgress(progressKey);
      const duration = Number.isFinite(currentVideo.duration)
        ? currentVideo.duration
        : 0;
      const savedTime = Number(saved?.currentTime || 0);

      if (savedTime > 8 && (!duration || savedTime < duration - 8)) {
        try {
          currentVideo.currentTime = savedTime;
        } catch {
          // Some streams reject seek before enough data is buffered.
        }
      }
    }

    function saveProgressNow() {
      const currentVideo = videoRef.current;

      if (!progressKey || !currentVideo) return;

      const currentTime = currentVideo.currentTime || 0;
      const duration = Number.isFinite(currentVideo.duration)
        ? currentVideo.duration
        : 0;

      saveVideoProgress(progressKey, {
        currentTime,
        duration,
        updatedAt: new Date().toISOString(),
        title,
        subtitle,
      });
    }`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
} else {
  // Fallback for already slightly formatted files.
  content = content.replace(
    /function restoreProgressIfNeeded\(\) \{[\s\S]*?\n    \}\n\n    function saveProgressNow\(\) \{[\s\S]*?\n    \}/,
    newBlock.trimEnd()
  );
}

if (content === before) {
  console.warn("Không thấy block progress cũ để sửa. Có thể file chưa apply patch progress hoặc đã được sửa rồi.");
} else {
  fs.writeFileSync(target, content, "utf8");
  console.log("patched components/NativeVideoPlayer.tsx");
}

console.log("Done. Run: npm run lint && npm run build");