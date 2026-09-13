import { useMemo, useState } from "react";
import type { AppDefinition } from "../core/apps";

type Props = {
  apps: AppDefinition[];
  onLaunch: (id: string) => void;
};

export function RunDialog({ apps, onLaunch }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return apps.slice(0, 8);
    return apps.filter((app) => app.id.includes(query) || app.name.toLowerCase().includes(query)).slice(0, 8);
  }, [apps, value]);

  const execute = () => {
    const query = value.trim().toLowerCase();
    if (!query) return;
    const match = apps.find((app) => app.id.toLowerCase() === query || app.name.toLowerCase() === query);
    if (!match) {
      setError(`Aplikace „${value.trim()}“ nebyla nalezena.`);
      return;
    }
    setError("");
    onLaunch(match.id);
  };

  return (
    <div className="run-dialog">
      <div className="run-main">
        <div className="run-icon">▶</div>
        <div className="run-copy">
          <h3>Spustit program</h3>
          <p>Zadejte název aplikace a LUXFERY ji spustí.</p>
          <input
            autoFocus
            className="sunken run-input"
            value={value}
            onChange={(event) => { setValue(event.target.value); setError(""); }}
            onKeyDown={(event) => { if (event.key === "Enter") execute(); }}
            placeholder="chatgpt, figma, vscode, explorer…"
            aria-label="Název aplikace"
          />
          {error && <div className="run-error" role="alert">{error}</div>}
        </div>
      </div>
      <div className="run-suggestions">
        {suggestions.map((app) => (
          <button key={app.id} onClick={() => onLaunch(app.id)} title={app.description}>
            <span>{app.icon}</span>{app.name}
          </button>
        ))}
      </div>
      <div className="run-actions">
        <button className="win-btn" onClick={execute}>OK</button>
        <button className="win-btn" onClick={() => setValue("")}>Storno</button>
      </div>
    </div>
  );
}
