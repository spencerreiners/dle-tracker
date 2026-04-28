import { useState, useEffect, useMemo } from 'react';
import { SEED_GAMES } from './gamesData.js';

// ============================================================================
        // ============================================================================

        const CATEGORIES = [
            "Card/Board", "Colors", "Estimation", "Food", "Geography", "History",
            "Math/Logic", "Movies/TV", "Music", "Science/Nature", "Shapes/Patterns",
            "Novelty", "Sports", "Trivia", "Vehicles", "Video Games", "Miscellaneous", "Words", "Custom"
        ];

        // ============================================================================
        // Date utilities
        // ============================================================================
        const todayKey = () => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        };

        const yesterdayKey = () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        };

        const daysBetween = (a, b) => {
            const da = new Date(a + "T00:00:00");
            const db = new Date(b + "T00:00:00");
            return Math.round((db - da) / (1000 * 60 * 60 * 24));
        };

        // ============================================================================
        // Storage
        // ============================================================================
        const STORAGE_KEY = "dle-tracker-v1";

        const loadState = () => {
            try {
                const data = localStorage.getItem(STORAGE_KEY);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.warn("Failed to load state from localStorage:", e);
                return null;
            }
        };

        const saveState = (games) => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ games }));
            } catch (e) {
                console.warn("Failed to save state to localStorage:", e);
            }
        };

        const initialGames = () => SEED_GAMES.map((g, i) => ({
            id: `seed-${i}`,
            name: g.name,
            url: g.url,
            category: g.category,
            favorite: false,
            history: {}, // { 'YYYY-MM-DD': { done: bool, score: string|null } }
        }));

        // ============================================================================
        // Main App
        // ============================================================================
        export default function DleTracker() {
            const [games, setGames] = useState(() => loadState()?.games || initialGames());
            const [view, setView] = useState("today"); // today | favorites | all | stats
            const [search, setSearch] = useState("");
            const [categoryFilter, setCategoryFilter] = useState("All");
            const [showAddModal, setShowAddModal] = useState(false);
            const [showSettings, setShowSettings] = useState(false);
            const [editingGame, setEditingGame] = useState(null);
            const [scoreModalGame, setScoreModalGame] = useState(null);
            const [collapsedCategories, setCollapsedCategories] = useState({});

            const today = todayKey();

            // Save state to localStorage whenever games change
            useEffect(() => {
                saveState(games);
            }, [games]);

            // ---------------------------------------------------------------------------
            // Derived state
            // ---------------------------------------------------------------------------
            const stats = useMemo(() => {
                const todayDone = games.filter(g => g.history[today]?.done).length;
                const todayFavoritesDone = games.filter(g => g.favorite && g.history[today]?.done).length;
                const favorites = games.filter(g => g.favorite).length;
                const totalPlays = games.reduce((sum, g) => sum + Object.values(g.history).filter(h => h.done).length, 0);

                // Compute current streak: consecutive days with at least one game completed
                const allDates = new Set();
                games.forEach(g => Object.entries(g.history).forEach(([d, h]) => h.done && allDates.add(d)));
                const sortedDates = [...allDates].sort().reverse();
                let streak = 0;
                let cursor = today;
                if (sortedDates.includes(today) || sortedDates.includes(yesterdayKey())) {
                    // start from the most recent completed day
                    cursor = sortedDates[0];
                    streak = 1;
                    for (let i = 1; i < sortedDates.length; i++) {
                        const diff = daysBetween(sortedDates[i], cursor);
                        if (diff === 1) {
                            streak++;
                            cursor = sortedDates[i];
                        } else break;
                    }
                    // if most recent completion isn't today or yesterday, streak is 0
                    if (sortedDates[0] !== today && sortedDates[0] !== yesterdayKey()) streak = 0;
                }

                return { todayDone, todayFavoritesDone, favorites, totalPlays, streak };
            }, [games, today]);

            const filteredGames = useMemo(() => {
                let list = games;
                if (view === "favorites") list = list.filter(g => g.favorite);
                if (view === "today") list = list.filter(g => g.favorite);
                if (categoryFilter !== "All") list = list.filter(g => g.category === categoryFilter);
                if (search.trim()) {
                    const q = search.toLowerCase();
                    list = list.filter(g => g.name.toLowerCase().includes(q));
                }
                return list;
            }, [games, view, search, categoryFilter]);

            const groupedGames = useMemo(() => {
                const groups = {};
                filteredGames.forEach(g => {
                    if (!groups[g.category]) groups[g.category] = [];
                    groups[g.category].push(g);
                });
                Object.keys(groups).forEach(k => groups[k].sort((a, b) => a.name.localeCompare(b.name)));
                return groups;
            }, [filteredGames]);

            // ---------------------------------------------------------------------------
            // Mutations
            // ---------------------------------------------------------------------------
            const toggleDone = (id) => {
                setGames(gs => gs.map(g => {
                    if (g.id !== id) return g;
                    const h = { ...g.history };
                    if (h[today]?.done) {
                        h[today] = { ...h[today], done: false };
                    } else {
                        h[today] = { ...(h[today] || {}), done: true };
                    }
                    return { ...g, history: h };
                }));
            };

            const toggleFavorite = (id) => {
                setGames(gs => gs.map(g => g.id === id ? { ...g, favorite: !g.favorite } : g));
            };

            const setScore = (id, score) => {
                setGames(gs => gs.map(g => {
                    if (g.id !== id) return g;
                    const h = { ...g.history };
                    h[today] = { ...(h[today] || { done: true }), score, done: true };
                    return { ...g, history: h };
                }));
            };

            const addGame = (game) => {
                setGames(gs => [...gs, {
                    id: `custom-${Date.now()}`,
                    name: game.name,
                    url: game.url,
                    category: game.category || "Custom",
                    favorite: true,
                    history: {},
                }]);
            };

            const updateGame = (id, updates) => {
                setGames(gs => gs.map(g => g.id === id ? { ...g, ...updates } : g));
            };

            const deleteGame = (id) => {
                setGames(gs => gs.filter(g => g.id !== id));
            };

            const toggleCategory = (cat) => {
                setCollapsedCategories(c => ({ ...c, [cat]: !c[cat] }));
            };

            // ---------------------------------------------------------------------------
            // Render
            // ---------------------------------------------------------------------------
            const todayFavoriteCount = games.filter(g => g.favorite).length;
            const todayProgress = todayFavoriteCount > 0 ? Math.round((stats.todayFavoritesDone / todayFavoriteCount) * 100) : 0;

            return (
                <div className="min-h-screen bg-stone-950 text-stone-100" style={{ fontFamily: '"Instrument Serif", Georgia, serif' }}>
                    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
        body { background: #0c0a09; }
        .font-display { font-family: 'Instrument Serif', Georgia, serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-sans { font-family: 'Inter Tight', system-ui, sans-serif; }
        .grain::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity: 0.06;
          pointer-events: none;
          mix-blend-mode: overlay;
        }
        .scroll-thin::-webkit-scrollbar { width: 6px; }
        .scroll-thin::-webkit-scrollbar-track { background: transparent; }
        .scroll-thin::-webkit-scrollbar-thumb { background: #44403c; border-radius: 3px; }
      `}</style>

                    <div className="relative grain min-h-screen">
                        {/* ============ HEADER ============ */}
                        <header className="border-b border-stone-800/60 sticky top-0 z-30 bg-stone-950/85 backdrop-blur-md">
                            <div className="max-w-6xl mx-auto px-6 py-5">
                                <div className="flex items-baseline justify-between gap-4 mb-4">
                                    <div>
                                        <h1 className="font-display text-4xl md:text-5xl tracking-tight text-stone-50 leading-none">
                                            the <em className="text-amber-700/90">dles</em>
                                        </h1>
                                        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500 mt-1.5">
                                            daily puzzle ledger · {today}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowSettings(true)}
                                        className="text-stone-500 hover:text-stone-200 transition-colors"
                                        aria-label="Settings"
                                    >
                                        <span>⚙️</span>
                                    </button>
                                </div>

                                {/* Stats strip */}
                                <div className="grid grid-cols-4 gap-px bg-stone-800/60 border border-stone-800/60">
                                    <Stat label="streak" value={stats.streak} icon={<span>🔥</span>} accent />
                                    <Stat label="today" value={`${stats.todayFavoritesDone}/${todayFavoriteCount}`} />
                                    <Stat label="favorites" value={stats.favorites} />
                                    <Stat label="total plays" value={stats.totalPlays} />
                                </div>

                                {/* Tab strip */}
                                <div className="flex gap-1 mt-4 border-b border-stone-800/60 -mb-5">
                                    {[
                                        { id: "today", label: "Today" },
                                        { id: "favorites", label: "Favorites" },
                                        { id: "all", label: `All (${games.length})` },
                                        { id: "stats", label: "Stats" },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setView(tab.id)}
                                            className={`px-4 py-2.5 font-sans text-xs uppercase tracking-wider transition-all relative ${view === tab.id
                                                    ? "text-amber-600"
                                                    : "text-stone-500 hover:text-stone-300"
                                                }`}
                                        >
                                            {tab.label}
                                            {view === tab.id && (
                                                <div className="absolute bottom-0 left-0 right-0 h-px bg-amber-700"></div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </header>

                        {/* ============ MAIN ============ */}
                        <main className="max-w-6xl mx-auto px-6 py-8">
                            {view === "stats" ? (
                                <StatsView games={games} />
                            ) : (
                                <>
                                    {/* Today progress bar */}
                                    {view === "today" && todayFavoriteCount > 0 && (
                                        <div className="mb-8 p-5 border border-stone-800/60 bg-stone-900/30">
                                            <div className="flex items-baseline justify-between mb-3">
                                                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">today's lineup</span>
                                                <span className="font-display text-3xl text-stone-100">{todayProgress}<span className="text-stone-600 text-xl">%</span></span>
                                            </div>
                                            <div className="h-1 bg-stone-800/80 overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-amber-700 to-amber-600 transition-all duration-500"
                                                    style={{ width: `${todayProgress}%` }}
                                                />
                                            </div>
                                            {todayProgress === 100 && (
                                                <p className="font-display italic text-amber-700/90 text-sm mt-3">All favorites complete for today.</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Empty state for favorites/today */}
                                    {view === "today" && todayFavoriteCount === 0 && (
                                        <div className="text-center py-16 border border-dashed border-stone-800">
                                            <p className="font-display italic text-stone-400 text-lg mb-2">No favorites yet.</p>
                                            <p className="font-sans text-xs text-stone-500 mb-6">Hit "All" to browse the full library and star the games you play.</p>
                                            <button
                                                onClick={() => setView("all")}
                                                className="font-mono text-[11px] uppercase tracking-wider text-amber-600 hover:text-amber-500 border border-amber-700/40 hover:border-amber-600 px-4 py-2"
                                            >
                                                Browse all games →
                                            </button>
                                        </div>
                                    )}

                                    {/* Search & filters (for "all" and "favorites") */}
                                    {(view === "all" || view === "favorites") && (
                                        <div className="flex flex-col md:flex-row gap-3 mb-6">
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">🔍</span>
                                                <input
                                                    type="text"
                                                    value={search}
                                                    onChange={e => setSearch(e.target.value)}
                                                    placeholder="search games..."
                                                    className="w-full bg-stone-900/40 border border-stone-800 pl-10 pr-3 py-2.5 font-sans text-sm text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-700/60 transition-colors"
                                                />
                                            </div>
                                            <select
                                                value={categoryFilter}
                                                onChange={e => setCategoryFilter(e.target.value)}
                                                className="bg-stone-900/40 border border-stone-800 px-3 py-2.5 font-sans text-sm text-stone-200 focus:outline-none focus:border-amber-700/60 cursor-pointer"
                                            >
                                                <option value="All">All categories</option>
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <button
                                                onClick={() => setShowAddModal(true)}
                                                className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 text-stone-50 px-4 py-2.5 font-sans text-sm transition-colors"
                                            >
                                                <span>➕</span> Add game
                                            </button>
                                        </div>
                                    )}

                                    {/* Games list grouped by category */}
                                    <div className="space-y-6">
                                        {Object.keys(groupedGames).sort().map(cat => {
                                            const isCollapsed = collapsedCategories[cat];
                                            const list = groupedGames[cat];
                                            const doneCount = list.filter(g => g.history[today]?.done).length;
                                            return (
                                                <section key={cat}>
                                                    <button
                                                        onClick={() => toggleCategory(cat)}
                                                        className="w-full flex items-center justify-between mb-3 group"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {isCollapsed ? <span className="text-stone-600">▶</span> : <span className="text-stone-600">▼</span>}
                                                            <h2 className="font-display text-2xl text-stone-200 group-hover:text-stone-50 transition-colors">{cat}</h2>
                                                            <span className="font-mono text-[10px] text-stone-600 ml-1">
                                                                {doneCount}/{list.length}
                                                            </span>
                                                        </div>
                                                        <div className="h-px flex-1 bg-stone-800/60 ml-4"></div>
                                                    </button>
                                                    {!isCollapsed && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                            {list.map(game => (
                                                                <GameCard
                                                                    key={game.id}
                                                                    game={game}
                                                                    today={today}
                                                                    onToggleDone={() => toggleDone(game.id)}
                                                                    onToggleFav={() => toggleFavorite(game.id)}
                                                                    onSetScore={() => setScoreModalGame(game)}
                                                                    onEdit={() => setEditingGame(game)}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </section>
                                            );
                                        })}
                                        {Object.keys(groupedGames).length === 0 && (view === "favorites" || view === "all") && (
                                            <div className="text-center py-12 border border-dashed border-stone-800">
                                                <p className="font-display italic text-stone-500">Nothing matches that.</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </main>

                        <footer className="border-t border-stone-800/60 mt-16 py-6 text-center">
                            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
                                data persists locally · {games.length} games loaded
                            </p>
                        </footer>
                    </div>

                    {/* ============ MODALS ============ */}
                    {showAddModal && (
                        <AddGameModal
                            onClose={() => setShowAddModal(false)}
                            onAdd={addGame}
                        />
                    )}
                    {scoreModalGame && (
                        <ScoreModal
                            game={scoreModalGame}
                            today={today}
                            onClose={() => setScoreModalGame(null)}
                            onSave={(score) => {
                                setScore(scoreModalGame.id, score);
                                setScoreModalGame(null);
                            }}
                        />
                    )}
                    {editingGame && (
                        <EditGameModal
                            game={editingGame}
                            onClose={() => setEditingGame(null)}
                            onSave={(updates) => {
                                updateGame(editingGame.id, updates);
                                setEditingGame(null);
                            }}
                            onDelete={() => {
                                if (confirm(`Delete "${editingGame.name}"? This removes all history for this game.`)) {
                                    deleteGame(editingGame.id);
                                    setEditingGame(null);
                                }
                            }}
                        />
                    )}
                    {showSettings && (
                        <SettingsModal
                            onClose={() => setShowSettings(false)}
                            games={games}
                            onReset={() => {
                                if (confirm("Reset all data? This wipes favorites, scores, and history.")) {
                                    setGames(initialGames());
                                    setShowSettings(false);
                                }
                            }}
                            onExport={() => {
                                const data = JSON.stringify(games, null, 2);
                                const blob = new Blob([data], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `dle-tracker-export-${today}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            onImport={(data) => {
                                try {
                                    const parsed = JSON.parse(data);
                                    if (Array.isArray(parsed)) setGames(parsed);
                                    setShowSettings(false);
                                } catch (e) {
                                    alert("Invalid JSON");
                                }
                            }}
                        />
                    )}
                </div>
            );
        }

        // ============================================================================
        // Sub-components
        // ============================================================================

        function Stat({ label, value, icon, accent }) {
            return (
                <div className="bg-stone-950 px-4 py-3 flex flex-col gap-0.5">
                    <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-stone-600 flex items-center gap-1">
                        {icon} {label}
                    </span>
                    <span className={`font-display text-3xl leading-none ${accent ? "text-amber-700" : "text-stone-100"}`}>
                        {value}
                    </span>
                </div>
            );
        }

        function GameCard({ game, today, onToggleDone, onToggleFav, onSetScore, onEdit }) {
            const todayHistory = game.history[today] || {};
            const done = !!todayHistory.done;
            const score = todayHistory.score;

            return (
                <div className={`group relative border transition-all ${done
                        ? "bg-amber-900/10 border-amber-800/40"
                        : "bg-stone-900/30 border-stone-800/60 hover:border-stone-700"
                    }`}>
                    <div className="p-3 flex items-center gap-2">
                        {/* Done checkbox */}
                        <button
                            onClick={onToggleDone}
                            className={`flex-shrink-0 w-6 h-6 border flex items-center justify-center transition-all ${done
                                    ? "bg-amber-700 border-amber-700 text-stone-50"
                                    : "border-stone-700 hover:border-stone-500"
                                }`}
                            aria-label={done ? "Mark as not done" : "Mark as done"}
                        >
                            {done && <span>✅</span>}
                        </button>

                        {/* Name + link */}
                        <div className="flex-1 min-w-0">
                            <a
                                href={game.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`font-sans text-sm truncate block hover:text-amber-600 transition-colors ${done ? "text-stone-400 line-through" : "text-stone-100"
                                    }`}
                                title={game.name}
                            >
                                {game.name}
                            </a>
                            {score && (
                                <span className="font-mono text-[10px] text-amber-700/90 block truncate">
                                    {score}
                                </span>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                                onClick={onSetScore}
                                className="p-1 text-stone-600 hover:text-amber-600 transition-colors opacity-0 group-hover:opacity-100"
                                title="Log score"
                            >
                                <span>📊</span>
                            </button>
                            <button
                                onClick={onEdit}
                                className="p-1 text-stone-600 hover:text-stone-300 transition-colors opacity-0 group-hover:opacity-100"
                                title="Edit"
                            >
                                <span>✏️</span>
                            </button>
                            <button
                                onClick={onToggleFav}
                                className={`p-1 transition-colors ${game.favorite
                                        ? "text-amber-600"
                                        : "text-stone-600 hover:text-stone-300"
                                    }`}
                                title={game.favorite ? "Unfavorite" : "Favorite"}
                            >
                                <span>⭐</span>
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        function AddGameModal({ onClose, onAdd }) {
            const [name, setName] = useState("");
            const [url, setUrl] = useState("");
            const [category, setCategory] = useState("Custom");

            return (
                <Modal onClose={onClose} title="Add a game">
                    <div className="space-y-4">
                        <Field label="Name">
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Bandle"
                                autoFocus
                                className="w-full bg-stone-950 border border-stone-800 px-3 py-2 font-sans text-sm text-stone-200 focus:outline-none focus:border-amber-700/60"
                            />
                        </Field>
                        <Field label="URL">
                            <input
                                type="text"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                placeholder="https://..."
                                className="w-full bg-stone-950 border border-stone-800 px-3 py-2 font-mono text-xs text-stone-200 focus:outline-none focus:border-amber-700/60"
                            />
                        </Field>
                        <Field label="Category">
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full bg-stone-950 border border-stone-800 px-3 py-2 font-sans text-sm text-stone-200 focus:outline-none focus:border-amber-700/60 cursor-pointer"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </Field>
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => {
                                    if (name && url) {
                                        let u = url.trim();
                                        if (!u.startsWith("http")) u = "https://" + u;
                                        onAdd({ name: name.trim(), url: u, category });
                                        onClose();
                                    }
                                }}
                                disabled={!name || !url}
                                className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-600 text-stone-50 px-4 py-2 font-sans text-sm transition-colors"
                            >
                                Add & favorite
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 border border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700 font-sans text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            );
        }

        function EditGameModal({ game, onClose, onSave, onDelete }) {
            const [name, setName] = useState(game.name);
            const [url, setUrl] = useState(game.url);
            const [category, setCategory] = useState(game.category);

            return (
                <Modal onClose={onClose} title="Edit game">
                    <div className="space-y-4">
                        <Field label="Name">
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-stone-950 border border-stone-800 px-3 py-2 font-sans text-sm text-stone-200 focus:outline-none focus:border-amber-700/60"
                            />
                        </Field>
                        <Field label="URL">
                            <input
                                type="text"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                                className="w-full bg-stone-950 border border-stone-800 px-3 py-2 font-mono text-xs text-stone-200 focus:outline-none focus:border-amber-700/60"
                            />
                        </Field>
                        <Field label="Category">
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full bg-stone-950 border border-stone-800 px-3 py-2 font-sans text-sm text-stone-200 focus:outline-none focus:border-amber-700/60 cursor-pointer"
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </Field>
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => onSave({ name, url, category })}
                                className="flex-1 bg-amber-700 hover:bg-amber-600 text-stone-50 px-4 py-2 font-sans text-sm transition-colors"
                            >
                                Save
                            </button>
                            <button
                                onClick={onDelete}
                                className="px-3 py-2 border border-red-900/40 text-red-700 hover:text-red-500 hover:border-red-700 font-sans text-sm transition-colors"
                                title="Delete"
                            >
                                <span>🗑️</span>
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 border border-stone-800 text-stone-400 hover:text-stone-200 font-sans text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            );
        }

        function ScoreModal({ game, today, onClose, onSave }) {
            const [score, setScore] = useState(game.history[today]?.score || "");
            return (
                <Modal onClose={onClose} title={`Log score · ${game.name}`}>
                    <div className="space-y-4">
                        <Field label="Score / result">
                            <input
                                type="text"
                                value={score}
                                onChange={e => setScore(e.target.value)}
                                placeholder="e.g. 3/6, 1:42, 8/10"
                                autoFocus
                                className="w-full bg-stone-950 border border-stone-800 px-3 py-2 font-mono text-sm text-stone-200 focus:outline-none focus:border-amber-700/60"
                            />
                        </Field>
                        <p className="font-sans text-xs text-stone-500">
                            Free-form. Anything works — guess counts, times, percentages.
                        </p>
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => onSave(score.trim() || null)}
                                className="flex-1 bg-amber-700 hover:bg-amber-600 text-stone-50 px-4 py-2 font-sans text-sm transition-colors"
                            >
                                Save & mark done
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 border border-stone-800 text-stone-400 hover:text-stone-200 font-sans text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            );
        }

        function SettingsModal({ onClose, onReset, onExport, onImport, games }) {
            const [importText, setImportText] = useState("");

            return (
                <Modal onClose={onClose} title="Settings">
                    <div className="space-y-5">
                        <div>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500 mb-2">Library</p>
                            <p className="font-sans text-sm text-stone-300">{games.length} games loaded · {games.filter(g => g.favorite).length} favorited</p>
                        </div>

                        <div className="border-t border-stone-800 pt-4">
                            <p className="font-mono text-[10px] uppercase tracking-wider text-stone-500 mb-2">Backup</p>
                            <button
                                onClick={onExport}
                                className="w-full text-left border border-stone-800 hover:border-stone-700 px-3 py-2 font-sans text-sm text-stone-200 mb-2 transition-colors"
                            >
                                Export data as JSON
                            </button>
                            <details>
                                <summary className="font-sans text-sm text-stone-400 cursor-pointer hover:text-stone-200">Import from JSON</summary>
                                <div className="mt-2 space-y-2">
                                    <textarea
                                        value={importText}
                                        onChange={e => setImportText(e.target.value)}
                                        placeholder="Paste exported JSON here..."
                                        className="w-full h-24 bg-stone-950 border border-stone-800 px-3 py-2 font-mono text-xs text-stone-200 focus:outline-none focus:border-amber-700/60"
                                    />
                                    <button
                                        onClick={() => onImport(importText)}
                                        disabled={!importText.trim()}
                                        className="bg-amber-700 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-600 text-stone-50 px-3 py-1.5 font-sans text-xs transition-colors"
                                    >
                                        Import
                                    </button>
                                </div>
                            </details>
                        </div>

                        <div className="border-t border-stone-800 pt-4">
                            <p className="font-mono text-[10px] uppercase tracking-wider text-red-700/80 mb-2">Danger zone</p>
                            <button
                                onClick={onReset}
                                className="w-full text-left border border-red-900/40 hover:border-red-800 px-3 py-2 font-sans text-sm text-red-700 hover:text-red-500 transition-colors"
                            >
                                Reset all data
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full px-4 py-2 border border-stone-800 text-stone-400 hover:text-stone-200 font-sans text-sm transition-colors mt-2"
                        >
                            Close
                        </button>
                    </div>
                </Modal>
            );
        }

        function StatsView({ games }) {
            const today = todayKey();
            const data = useMemo(() => {
                // Most-played games
                const byPlays = games
                    .map(g => ({
                        ...g,
                        playCount: Object.values(g.history).filter(h => h.done).length,
                    }))
                    .filter(g => g.playCount > 0)
                    .sort((a, b) => b.playCount - a.playCount);

                // Last 30 days activity
                const days = [];
                for (let i = 29; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    const count = games.reduce((sum, g) => sum + (g.history[key]?.done ? 1 : 0), 0);
                    days.push({ date: key, count, label: `${d.getMonth() + 1}/${d.getDate()}` });
                }
                const maxCount = Math.max(1, ...days.map(d => d.count));

                // Category breakdown
                const byCategory = {};
                games.forEach(g => {
                    const plays = Object.values(g.history).filter(h => h.done).length;
                    if (plays > 0) byCategory[g.category] = (byCategory[g.category] || 0) + plays;
                });
                const catList = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
                const catMax = Math.max(1, ...catList.map(c => c[1]));

                return { byPlays, days, maxCount, catList, catMax };
            }, [games]);

            return (
                <div className="space-y-10">
                    {/* 30-day heatmap */}
                    <section>
                        <h2 className="font-display text-2xl text-stone-200 mb-1">Last 30 days</h2>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-stone-600 mb-4">games completed per day</p>
                        <div className="flex items-end gap-1 h-32 border-b border-stone-800/60 pb-1">
                            {data.days.map(day => (
                                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                                    <div
                                        className={`w-full transition-all ${day.count > 0 ? "bg-amber-700/80 hover:bg-amber-600" : "bg-stone-800/40"}`}
                                        style={{ height: `${(day.count / data.maxCount) * 100}%`, minHeight: "2px" }}
                                    />
                                    <div className="absolute -top-8 hidden group-hover:block bg-stone-900 border border-stone-700 px-2 py-0.5 text-[10px] font-mono text-stone-200 whitespace-nowrap z-10">
                                        {day.label}: {day.count}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between font-mono text-[9px] text-stone-600 mt-1.5">
                            <span>{data.days[0]?.label}</span>
                            <span>today</span>
                        </div>
                    </section>

                    {/* Most played */}
                    <section>
                        <h2 className="font-display text-2xl text-stone-200 mb-1">Most played</h2>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-stone-600 mb-4">your top games by completion count</p>
                        {data.byPlays.length === 0 ? (
                            <p className="font-display italic text-stone-500">Nothing played yet.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {data.byPlays.slice(0, 12).map((g, i) => {
                                    const max = data.byPlays[0].playCount;
                                    return (
                                        <div key={g.id} className="flex items-center gap-3 text-sm">
                                            <span className="font-mono text-[10px] text-stone-600 w-5 text-right">{String(i + 1).padStart(2, "0")}</span>
                                            <a href={g.url} target="_blank" rel="noopener noreferrer" className="font-sans text-stone-200 hover:text-amber-600 w-44 truncate transition-colors">{g.name}</a>
                                            <div className="flex-1 h-1.5 bg-stone-800/60">
                                                <div
                                                    className="h-full bg-amber-700/80"
                                                    style={{ width: `${(g.playCount / max) * 100}%` }}
                                                />
                                            </div>
                                            <span className="font-mono text-xs text-stone-400 w-8 text-right">{g.playCount}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* By category */}
                    {data.catList.length > 0 && (
                        <section>
                            <h2 className="font-display text-2xl text-stone-200 mb-1">By category</h2>
                            <p className="font-mono text-[10px] uppercase tracking-wider text-stone-600 mb-4">where you spend your time</p>
                            <div className="space-y-1.5">
                                {data.catList.map(([cat, plays]) => (
                                    <div key={cat} className="flex items-center gap-3 text-sm">
                                        <span className="font-sans text-stone-300 w-32 truncate">{cat}</span>
                                        <div className="flex-1 h-1.5 bg-stone-800/60">
                                            <div
                                                className="h-full bg-amber-700/80"
                                                style={{ width: `${(plays / data.catMax) * 100}%` }}
                                            />
                                        </div>
                                        <span className="font-mono text-xs text-stone-400 w-8 text-right">{plays}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            );
        }

        function Modal({ children, onClose, title }) {
            return (
                <div
                    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <div
                        className="bg-stone-900 border border-stone-800 max-w-md w-full p-6 relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-baseline justify-between mb-5">
                            <h3 className="font-display text-2xl text-stone-100">{title}</h3>
                            <button onClick={onClose} className="text-stone-500 hover:text-stone-200 transition-colors">
                                <span>✕</span>
                            </button>
                        </div>
                        {children}
                    </div>
                </div>
            );
        }

        function Field({ label, children }) {
            return (
                <div>
                    <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-1.5">{label}</label>
                    {children}
                </div>
            );
        }

