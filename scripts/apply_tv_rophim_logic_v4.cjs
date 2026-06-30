
const fs = require("fs");
const path = require("path");
const root = process.cwd();
function read(p){return fs.readFileSync(path.join(root,p),"utf8")}
function write(p,c){const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c,"utf8");console.log(`patched ${p}`)}
function script(name){return fs.readFileSync(path.join(__dirname,name),"utf8")}
function patchOverlay(){
  const p="components/TvWatchOverlay.tsx";
  let c=read(p);
  c=c.replace("const AUTO_HIDE_MS = 3400;","const AUTO_HIDE_MS = 2300;");
  c=c.replace("const SEEK_SECONDS = 10;","const SEEK_SECONDS = 10;\nconst CHUNK_SIZE = 24;");
  if(!c.includes("activeChunkIndex")){
    c=c.replace("const [nativeHintVisible, setNativeHintVisible] = useState(false);","const [nativeHintVisible, setNativeHintVisible] = useState(false);\n  const [activeChunkIndex, setActiveChunkIndex] = useState(0);");
    c=c.replace(/  const episodeItems = useMemo\(\(\) => \{[\s\S]*?  \}, \[currentEpisodes, movie\.slug, safeServerIndex\]\);/, `  const episodeChunks = useMemo(() => {
    const chunks: { start: number; end: number; label: string }[] = [];

    for (let start = 0; start < currentEpisodes.length; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, currentEpisodes.length - 1);
      chunks.push({ start, end, label: \`\${start + 1}-\${end + 1}\` });
    }

    return chunks;
  }, [currentEpisodes.length]);

  const safeChunkIndex = activeChunkIndex >= episodeChunks.length ? 0 : activeChunkIndex;
  const activeChunk = episodeChunks[safeChunkIndex];

  const episodeItems = useMemo(() => {
    if (!activeChunk) return [];

    return currentEpisodes
      .slice(activeChunk.start, activeChunk.end + 1)
      .map((episode, index) => {
        const episodeIndex = activeChunk.start + index;

        return {
          episode,
          episodeIndex,
          href: getEpisodeUrl(movie.slug, safeServerIndex, episodeIndex),
        };
      });
  }, [activeChunk, currentEpisodes, movie.slug, safeServerIndex]);`);
    c=c.replace("  useEffect(() => {\n    setOverlayPanel(null);\n    showPeek({ focus: false });\n  }, [safeEpisodeIndex, currentServer?.server_name]);", `  useEffect(() => {
    setOverlayPanel(null);
    setActiveChunkIndex(Math.max(0, Math.floor(safeEpisodeIndex / CHUNK_SIZE)));
    showPeek({ focus: false });
  }, [safeEpisodeIndex, currentServer?.server_name]);`);
    c=c.replace(/                <div data-tv-row className="max-h-\[33vh\] overflow-y-auto pr-1">[\s\S]*?                <\/div>\n              <\/div>\n            \)}/, `                {episodeChunks.length > 1 && (
                  <div data-tv-row data-tv-row-wrap="true" className="mb-2 flex flex-wrap gap-1.5">
                    {episodeChunks.map((chunk, index) => (
                      <button
                        key={chunk.label}
                        type="button"
                        onClick={() => setActiveChunkIndex(index)}
                        data-tv-panel-default={index === safeChunkIndex ? "episodes" : undefined}
                        className={[
                          "rounded-lg border px-2.5 py-1.5 text-[10px] font-black transition",
                          index === safeChunkIndex
                            ? "border-yellow-300 bg-yellow-300 text-black"
                            : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                          TV_FOCUS_CLASS,
                        ].join(" ")}
                      >
                        {chunk.label}
                      </button>
                    ))}
                  </div>
                )}

                <div data-tv-row data-tv-row-wrap="true" className="max-h-[34vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-6 gap-2 min-[1280px]:grid-cols-8">
                    {episodeItems.map((item) => {
                      const active = item.episodeIndex === safeEpisodeIndex;
                      const watched = watchedEpisodes.includes(
                        getWatchedKey(movie.slug, safeServerIndex, item.episodeIndex)
                      );

                      return (
                        <Link
                          key={\`\${safeServerIndex}-\${item.episode.name}-\${item.episodeIndex}\`}
                          href={item.href}
                          data-tv-panel-default={active ? "episodes" : undefined}
                          className={[
                            "relative flex min-h-[32px] items-center justify-center rounded-xl border px-1.5 text-center text-[10px] font-black transition min-[1280px]:min-h-[36px] min-[1280px]:text-[11px]",
                            active
                              ? "border-yellow-300 bg-yellow-300 text-black"
                              : watched
                                ? "border-white/[0.12] bg-white/[0.14] text-white hover:bg-white/20"
                                : "border-white/10 bg-white/[0.055] text-white hover:bg-white/15",
                            TV_FOCUS_CLASS,
                          ].join(" ")}
                        >
                          <span className="line-clamp-1">
                            {item.episode.name || \`Tập \${item.episodeIndex + 1}\`}
                          </span>
                          {watched && !active && (
                            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-yellow-300" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}`);
  }
  write(p,c);
}
write("components/TvDashboard.tsx", script("TvDashboard.tsx.txt"));
write("components/TvMovieDetailShell.tsx", script("TvMovieDetailShell.tsx.txt"));
write("components/TvSearchBox.tsx", script("TvSearchBox.tsx.txt"));
write("components/FilterPanel.tsx", script("FilterPanel.tsx.txt"));
patchOverlay();
console.log("Done. Run: npm run lint && npm run build");
