import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import './App.css'
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, Line, Area
} from 'recharts'

const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : '';

// ── Timestamp formatter ────────────────────────────────────────────────────────
const formatXAxisTimestamp = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts
  const mm  = String(d.getMonth() + 1).padStart(2, '0')
  const dd  = String(d.getDate()).padStart(2, '0')
  const hh  = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${min}`
}

// ── Chart Tooltip ──────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const temp        = payload.find(p => p.dataKey === 'temperature')?.value
  const usageScaled = payload.find(p => p.dataKey === 'usageScaled')?.value
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{formatXAxisTimestamp(label)}</div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-dot" style={{ background: '#f85149' }} />
        <span className="chart-tooltip-label">Temperature</span>
        <span className="chart-tooltip-val">{temp?.toFixed(2)}°C</span>
      </div>
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-dot" style={{ background: '#58a6ff' }} />
        <span className="chart-tooltip-label">Usage</span>
        <span className="chart-tooltip-val">{usageScaled > 0 ? 'In Use' : 'Off'}</span>
      </div>
    </div>
  )
}

// ── Reusable DropZone ──────────────────────────────────────────────────────────
function DropZone({ file, onFile, label, tagClass = 'baseline', className = '', single = false }) {
  const [dragging, setDragging] = useState(false)
  const ref = useRef(null)
  const handleFile = useCallback((f) => { if (f && f.name.endsWith('.csv')) onFile(f) }, [onFile])

  return (
    <div className="drop-zone-wrapper">
      {label && <span className={`drop-zone-tag ${tagClass}`}>{label}</span>}
      <div
        className={`drop-zone ${single ? 'single' : ''} ${className} ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => ref.current?.click()}
      >
        <input ref={ref} type="file" accept=".csv"
          style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }}
          onChange={e => handleFile(e.target.files[0])}
          onClick={e => e.stopPropagation()}
        />
        <div className="drop-icon">{file ? '📄' : '📂'}</div>
        <div className="drop-title">{file ? 'File selected' : 'Drop CSV here'}</div>
        {file
          ? <span className={`file-name ${tagClass === 'newstove' ? 'newstove' : ''}`}>{file.name}</span>
          : <span className="drop-sub">or click to browse</span>
        }
      </div>
    </div>
  )
}

// ── Single Results ─────────────────────────────────────────────────────────────
function SingleResults({ results, confidence, precision, onReset }) {
  const sa = results.sample_size_analysis
  const ca = results.confidence_analysis
  const targetPct = precision * 100
  const actualPct = ca.relative_moe_percent ?? 0
  const barMax = Math.max(actualPct, targetPct) * 1.4
  const barFillPct = Math.min((actualPct / barMax) * 100, 100)
  const targetLinePct = Math.min((targetPct / barMax) * 100, 100)
  const passes = ca.meets_criteria

  return (
    <div className="results-section">
      <div className="results-header">
        <div>
          <div className="results-title">Single Dataset Analysis</div>
          <div className="results-files">
            <span className="results-file">
              <span className="results-file-dot baseline" />{results.filename}
            </span>
          </div>
        </div>
        <button className="reset-btn" onClick={onReset}>↩ New Analysis</button>
      </div>

      <div className={`verdict ${passes ? 'pass' : 'fail'}`}>
        <span className="verdict-icon">{passes ? '✓' : '△'}</span>
        <div>
          <div className="verdict-label">{passes ? 'Criteria Met' : 'Criteria Not Met'}</div>
          <div className="verdict-msg">
            {passes
              ? `Sample is sufficiently precise at ${(confidence * 100).toFixed(0)}% confidence.`
              : `Margin of error exceeds the ${targetPct.toFixed(0)}% precision target.`}
          </div>
          <div className="verdict-detail">{ca.sample_size} observations analyzed</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card accent">
          <span className="stat-card-label">Required Sample Size</span>
          <span className="stat-card-value">{sa.required_sample_size?.toLocaleString()}</span>
          <span className="stat-card-sub">to meet precision target</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Current Sample</span>
          <span className="stat-card-value">{ca.sample_size?.toLocaleString()}</span>
          <span className="stat-card-sub">observations in dataset</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Mean</span>
          <span className="stat-card-value">{sa.mean?.toFixed(3)}</span>
          <span className="stat-card-sub">average value</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Std Dev (σ)</span>
          <span className="stat-card-value">{ca.std_dev?.toFixed(3)}</span>
          <span className="stat-card-sub">sample standard deviation</span>
        </div>
      </div>

      <div className="moe-section">
        <div className="moe-header">
          <span className="moe-title">Relative Margin of Error</span>
          <span className="moe-pct" style={{ color: passes ? '#2ea8aa' : '#e3a008' }}>
            {actualPct?.toFixed(2)}%
          </span>
        </div>
        <div>
          <div className="bar-track">
            <div className={`bar-fill ${passes ? 'pass' : 'fail'}`} style={{ width: `${barFillPct}%` }} />
          </div>
          <div className="bar-target-line">
            <div className="bar-target-marker" style={{ left: `${targetLinePct}%` }}>
              <div className="tick" />
              <span className="tick-label">target {targetPct.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="two-panel">
        <div className="panel">
          <div className="panel-title">Sample Size Analysis</div>
          {[
            ['Mean', sa.mean?.toFixed(4)],
            ['Std Dev', sa.sd?.toFixed(4)],
            ['COV', sa.cov?.toFixed(4)],
            ['Z-Score', sa.z_score?.toFixed(3)],
            ['Required n', sa.required_sample_size],
          ].map(([k, v]) => (
            <div className="kv-row" key={k}>
              <span className="kv-key">{k}</span>
              <span className="kv-val" style={k === 'Required n' ? { color: '#2ea8aa' } : {}}>{v}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-title">Confidence Analysis</div>
          {[
            ['Sample Size', ca.sample_size],
            ['Mean', ca.mean?.toFixed(4)],
            ['Abs. MOE', ca.absolute_moe?.toFixed(4)],
            ['Rel. MOE', `${ca.relative_moe_percent?.toFixed(2)}%`],
            ['Meets Criteria', passes ? 'Yes ✓' : 'No △'],
          ].map(([k, v]) => (
            <div className="kv-row" key={k}>
              <span className="kv-key">{k}</span>
              <span className="kv-val" style={k === 'Meets Criteria' ? { color: passes ? '#2ea8aa' : '#e3a008' } : {}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Comparison Results ─────────────────────────────────────────────────────────
function ComparisonResults({ results, onReset }) {
  const bh  = results.baseline_health
  const cr  = results.comparison_results
  const ch  = cr.change_analysis
  const sig = cr.significance_analysis

  const isSig     = sig.is_significant
  const pctChange = ch.percentage_change
  const absChange = ch.absolute_change
  const isDecrease = absChange < 0

  const barMax      = Math.max(ch.baseline_mean, ch.newstove_mean) * 1.15
  const baselinePct = Math.min((ch.baseline_mean / barMax) * 100, 100)
  const newstovedPct= Math.min((ch.newstove_mean / barMax) * 100, 100)

  const sa = bh.sample_size_analysis
  const ca = bh.confidence_analysis

  return (
    <div className="results-section">
      <div className="results-header">
        <div>
          <div className="results-title">Comparison Analysis</div>
          <div className="results-files">
            <span className="results-file">
              <span className="results-file-dot baseline" />{results.baseline_filename}
            </span>
            <span className="results-file">
              <span className="results-file-dot newstove" />{results.newstove_filename}
            </span>
          </div>
        </div>
        <button className="reset-btn" onClick={onReset}>↩ New Analysis</button>
      </div>

      {/* Significance verdict */}
      <div className={`verdict ${isSig ? 'sig' : 'insig'}`}>
        <span className="verdict-icon">{isSig ? '✓' : '○'}</span>
        <div>
          <div className="verdict-label">{isSig ? 'Statistically Significant' : 'Not Significant'}</div>
          <div className="verdict-msg">
            {isSig
              ? `A real difference between stoves was detected (p = ${sig.p_value}).`
              : `No statistically significant difference detected (p = ${sig.p_value}).`}
          </div>
          <div className="verdict-detail">{sig.test_type} · α = {sig.alpha_level}</div>
        </div>
      </div>

      {/* Change cards */}
      <div className="stats-grid">
        <div className={`stat-card ${isDecrease ? 'accent' : 'amber-accent'}`}>
          <span className="stat-card-label">% Change</span>
          <span className="stat-card-value">
            {pctChange !== null ? `${pctChange > 0 ? '+' : ''}${pctChange?.toFixed(1)}%` : 'N/A'}
          </span>
          <span className="stat-card-sub">new stove vs. baseline</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Absolute Change</span>
          <span className="stat-card-value">{absChange > 0 ? '+' : ''}{absChange?.toFixed(4)}</span>
          <span className="stat-card-sub">mean difference</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Baseline Mean</span>
          <span className="stat-card-value">{ch.baseline_mean?.toFixed(3)}</span>
          <span className="stat-card-sub">{results.baseline_filename}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">New Stove Mean</span>
          <span className="stat-card-value">{ch.newstove_mean?.toFixed(3)}</span>
          <span className="stat-card-sub">{results.newstove_filename}</span>
        </div>
      </div>

      {/* Visual comparison bars */}
      <div className="compare-bar-section">
        <span className="compare-bar-title">Mean Comparison</span>
        <div className="compare-bar-row">
          <div className="compare-bar-label">
            <span className="compare-bar-name">Baseline</span>
            <span className="compare-bar-val" style={{ color: '#8b949e' }}>{ch.baseline_mean?.toFixed(4)}</span>
          </div>
          <div className="cbar-track">
            <div className="cbar-fill baseline" style={{ width: `${baselinePct}%` }} />
          </div>
        </div>
        <div className="compare-bar-row">
          <div className="compare-bar-label">
            <span className="compare-bar-name">New Stove</span>
            <span className="compare-bar-val" style={{ color: '#e3a008' }}>{ch.newstove_mean?.toFixed(4)}</span>
          </div>
          <div className="cbar-track">
            <div className="cbar-fill newstove" style={{ width: `${newstovedPct}%` }} />
          </div>
        </div>
      </div>

      {/* Test + Change panels */}
      <div className="two-panel">
        <div className="panel">
          <div className="panel-title">Significance Test</div>
          {[
            ['Test Type', sig.test_type],
            ['T-Statistic', sig.t_statistic?.toFixed(4)],
            ['Alpha (α)', sig.alpha_level],
          ].map(([k, v]) => (
            <div className="kv-row" key={k}>
              <span className="kv-key">{k}</span>
              <span className="kv-val">{v}</span>
            </div>
          ))}
          <div className="kv-row">
            <span className="kv-key">P-Value</span>
            <span className={`pval-pill ${isSig ? 'sig' : 'insig'}`}>{sig.p_value}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Significant</span>
            <span className="kv-val" style={{ color: isSig ? '#2ea8aa' : '#8b949e' }}>
              {isSig ? 'Yes ✓' : 'No ○'}
            </span>
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">Change Analysis</div>
          {[
            ['Baseline Mean',   ch.baseline_mean?.toFixed(4)],
            ['New Stove Mean',  ch.newstove_mean?.toFixed(4)],
            ['Absolute Δ',      `${absChange > 0 ? '+' : ''}${absChange?.toFixed(4)}`],
            ['Percentage Δ',    pctChange !== null ? `${pctChange > 0 ? '+' : ''}${pctChange?.toFixed(2)}%` : 'N/A'],
          ].map(([k, v]) => (
            <div className="kv-row" key={k}>
              <span className="kv-key">{k}</span>
              <span className="kv-val">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sub-divider">Baseline Health Check</div>

      <div className="two-panel">
        <div className="panel">
          <div className="panel-title">Sample Size Analysis</div>
          {[
            ['Mean',       sa.mean?.toFixed(4)],
            ['Std Dev',    sa.sd?.toFixed(4)],
            ['COV',        sa.cov?.toFixed(4)],
            ['Z-Score',    sa.z_score?.toFixed(3)],
            ['Required n', sa.required_sample_size],
          ].map(([k, v]) => (
            <div className="kv-row" key={k}>
              <span className="kv-key">{k}</span>
              <span className="kv-val" style={k === 'Required n' ? { color: '#2ea8aa' } : {}}>{v}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-title">Baseline Confidence</div>
          {[
            ['Sample Size',    ca.sample_size],
            ['Mean',           ca.mean?.toFixed(4)],
            ['Abs. MOE',       ca.absolute_moe?.toFixed(4)],
            ['Rel. MOE',       `${ca.relative_moe_percent?.toFixed(2)}%`],
            ['Meets Criteria', ca.meets_criteria ? 'Yes ✓' : 'No △'],
          ].map(([k, v]) => (
            <div className="kv-row" key={k}>
              <span className="kv-key">{k}</span>
              <span className="kv-val"
                style={k === 'Meets Criteria' ? { color: ca.meets_criteria ? '#2ea8aa' : '#e3a008' } : {}}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Visualization Results ──────────────────────────────────────────────────────
function VisualizationResults({ results, onReset }) {
  const { summary, data, filename } = results

  const chartData = useMemo(() =>
    data.map(d => ({ ...d, usageScaled: d.usage * 10 })),
    [data]
  )

  const fmtDate = (iso) => new Date(iso).toLocaleString()

  return (
    <div className="results-section">
      <div className="results-header">
        <div>
          <div className="results-title">{summary.stove_name} — Sensor Visualization</div>
          <div className="results-files">
            <span className="results-file">
              <span className="results-file-dot baseline" />{filename}
            </span>
          </div>
        </div>
        <button className="reset-btn" onClick={onReset}>↩ New Analysis</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card accent">
          <span className="stat-card-label">Cooking Events</span>
          <span className="stat-card-value">{summary.cooking_events}</span>
          <span className="stat-card-sub">0→1 transitions</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Time In Use</span>
          <span className="stat-card-value">{summary.usage_percent}%</span>
          <span className="stat-card-sub">of total session</span>
        </div>
        <div className="stat-card amber-accent">
          <span className="stat-card-label">Peak Temperature</span>
          <span className="stat-card-value">{summary.max_temperature}°C</span>
          <span className="stat-card-sub">maximum recorded</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Total Readings</span>
          <span className="stat-card-value">{summary.total_readings.toLocaleString()}</span>
          <span className="stat-card-sub">data points</span>
        </div>
      </div>

      <div className="chart-section">
        <div className="chart-header">
          <span className="chart-title">Temperature &amp; Usage Over Time</span>
          <div className="chart-legend">
            <div className="chart-legend-item">
              <span className="chart-legend-swatch" style={{ background: '#f85149' }} />
              Temperature (°C)
            </div>
            <div className="chart-legend-item">
              <span className="chart-legend-swatch" style={{ background: '#58a6ff' }} />
              Stove Usage
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={420}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxisTimestamp}
              minTickGap={60}
              tick={{ fontSize: 11, fill: '#6e7681' }}
              axisLine={{ stroke: '#30363d' }}
              tickLine={{ stroke: '#30363d' }}
            />
            <YAxis
              label={{ value: 'Value', angle: -90, position: 'insideLeft', offset: 10, style: { fill: '#6e7681', fontSize: 11 } }}
              tick={{ fontSize: 11, fill: '#6e7681' }}
              axisLine={{ stroke: '#30363d' }}
              tickLine={{ stroke: '#30363d' }}
            />
            <Tooltip content={ChartTooltip} />
            <Legend wrapperStyle={{ display: 'none' }} />
            <Area
              type="stepAfter"
              dataKey="usageScaled"
              stroke="#58a6ff"
              fill="#58a6ff"
              fillOpacity={0.55}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#f85149"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="two-panel">
        <div className="panel">
          <div className="panel-title">Session Summary</div>
          {[
            ['Stove Name',     summary.stove_name],
            ['Sensor Type',    summary.sensor_type],
            ['Sensor ID',      summary.sensor_id],
            ['Start',          fmtDate(summary.start_time)],
            ['End',            fmtDate(summary.end_time)],
            ['Total Readings', summary.total_readings.toLocaleString()],
            ['Cooking Events', summary.cooking_events],
          ].map(([k, v]) => (
            <div className="kv-row" key={k}>
              <span className="kv-key">{k}</span>
              <span className="kv-val">{v}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-title">Temperature Stats</div>
          {[
            ['Min Temp',              `${summary.min_temperature}°C`],
            ['Mean Temp',             `${summary.mean_temperature}°C`],
            ['Max Temp',              `${summary.max_temperature}°C`],
            ['Usage %',               `${summary.usage_percent}%`],
            ['Events / Day',          summary.cooking_events_per_day],
            ['Cooking Time / Day',    `${summary.cooking_time_per_day} min`],
          ].map(([k, v]) => (
            <div className="kv-row" key={k}>
              <span className="kv-key">{k}</span>
              <span className="kv-val">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState('single')

  // Shared params
  const [targetCol,  setTargetCol]  = useState('Dry_Wood_Per_Cap')
  const [confidence, setConfidence] = useState(0.90)
  const [precision,  setPrecision]  = useState(0.10)

  const [availableColumns, setAvailableColumns] = useState([])

  // Single
  const [singleFile, setSingleFile] = useState(null)

  // Compare
  const [baselineFile, setBaselineFile] = useState(null)
  const [newStoveFile, setNewStoveFile] = useState(null)
  const [paired, setPaired] = useState(true)
  const alpha = 0.05

  // Visualize
  const [visualizeFile, setVisualizeFile] = useState(null)

  const [status,   setStatus]   = useState('idle')
  const [results,  setResults]  = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (mode === 'visualize') return  // visualize mode parses headers server-side

    const activeFile = mode === 'single' ? singleFile : baselineFile

    if (!activeFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailableColumns([])
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const firstLine = text.split(/\r?\n/)[0]
      if (firstLine) {
        const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''))
        setAvailableColumns(headers)
        if (headers.length > 0 && !headers.includes(targetCol)) {
          setTargetCol(headers[0])
        }
      }
    }
    reader.readAsText(activeFile.slice(0, 8192))
  }, [singleFile, baselineFile, mode, targetCol])

  const switchMode = (m) => { setMode(m); setStatus('idle'); setResults(null); setErrorMsg('') }

  const canRun = mode === 'single'
    ? !!singleFile && !!targetCol
    : mode === 'compare'
    ? !!baselineFile && !!newStoveFile && !!targetCol
    : !!visualizeFile

  const runAnalysis = async () => {
    setStatus('loading')
    setErrorMsg('')
    try {
      let res
      if (mode === 'single') {
        const form = new FormData()
        form.append('file', singleFile)
        form.append('target_column', targetCol)
        form.append('confidence_level', String(confidence))
        form.append('precision', String(precision))
        res = await fetch(`${API_BASE}/api/single-analysis`, { method: 'POST', body: form })
      } else if (mode === 'compare') {
        const form = new FormData()
        form.append('baseline_file', baselineFile)
        form.append('newstove_file', newStoveFile)
        form.append('target_column', targetCol)
        form.append('confidence_level', String(confidence))
        form.append('precision', String(precision))
        form.append('paired', String(paired))
        form.append('alpha', String(alpha))
        res = await fetch(`${API_BASE}/api/comparison-analysis`, { method: 'POST', body: form })
      } else {
        const form = new FormData()
        form.append('file', visualizeFile)
        res = await fetch(`${API_BASE}/api/visualize-data`, { method: 'POST', body: form })
      }
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      setResults(await res.json())
      setStatus('success')
    } catch (err) {
      setErrorMsg(err.message)
      setStatus('error')
    }
  }

  const reset = () => {
    setStatus('idle'); setResults(null)
    setSingleFile(null); setBaselineFile(null); setNewStoveFile(null)
    setVisualizeFile(null); setErrorMsg('')
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-dot" />
        <span className="header-title">KPT · <span>Analysis Dashboard</span></span>
        <span className="header-badge">v2.0</span>
      </header>

      <main className="main">
        {status === 'success' ? (
          mode === 'single'
            ? <SingleResults results={results} confidence={confidence} precision={precision} onReset={reset} />
            : mode === 'compare'
            ? <ComparisonResults results={results} onReset={reset} />
            : <VisualizationResults results={results} onReset={reset} />
        ) : status === 'loading' ? (
          <div className="loading-state">
            <div className="spinner" />
            <span className="loading-text">
              {mode === 'visualize'
                ? 'Parsing sensor data…'
                : `Processing dataset${mode === 'compare' ? 's' : ''}…`}
            </span>
          </div>
        ) : (
          <div className="upload-section">
            {/* Mode toggle */}
            <div className="mode-toggle">
              <button className={`mode-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => switchMode('single')}>
                Single Dataset
              </button>
              <button className={`mode-btn ${mode === 'compare' ? 'active' : ''}`} onClick={() => switchMode('compare')}>
                Compare Two Datasets
              </button>
              <button className={`mode-btn ${mode === 'visualize' ? 'active' : ''}`} onClick={() => switchMode('visualize')}>
                Visualize Stove Usage
              </button>
            </div>

            <div className="section-label">Data Input</div>

            {mode === 'single' ? (
              <DropZone file={singleFile} onFile={setSingleFile} single />
            ) : mode === 'compare' ? (
              <div className="drop-zones-row">
                <DropZone file={baselineFile} onFile={setBaselineFile} label="Baseline Stove" tagClass="baseline" />
                <DropZone file={newStoveFile} onFile={setNewStoveFile} label="New Stove" tagClass="newstove" className="newstove-zone" />
              </div>
            ) : (
              <>
                <DropZone file={visualizeFile} onFile={setVisualizeFile} label="Sensor CSV" tagClass="baseline" single />
                <div className="info-box">
                  <span>ℹ</span>
                  <div>Expects a sensor CSV with a metadata preamble followed by a <strong>Timestamp</strong>, <strong>Usage</strong>, and <strong>Temperature</strong> data table (EXACT sensor format).</div>
                </div>
              </>
            )}

            {mode !== 'visualize' && (
              <>
                <div className="section-label">Parameters</div>
                <div className={`params-grid ${mode === 'compare' ? 'cols-4' : ''}`}>
                  <div className="param-card">
                    <label className="param-label">Target Column</label>
                    <select
                      className="param-input"
                      value={targetCol}
                      onChange={e => setTargetCol(e.target.value)}
                      disabled={availableColumns.length === 0}
                    >
                      {availableColumns.length > 0 ? (
                        availableColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))
                      ) : (
                        <option value={targetCol}>{targetCol}</option>
                      )}
                    </select>
                    <span className="param-hint">Select column from CSV</span>
                  </div>

                  <div className="param-card">
                    <label className="param-label">Confidence Level</label>
                    <input className="param-input" type="number" step="0.01" min="0.5" max="0.999"
                      value={confidence} onChange={e => setConfidence(parseFloat(e.target.value))} />
                    <span className="param-hint">0 – 1 (e.g. 0.90)</span>
                  </div>
                  <div className="param-card">
                    <label className="param-label">Precision (ε)</label>
                    <input className="param-input" type="number" step="0.01" min="0.01" max="0.5"
                      value={precision} onChange={e => setPrecision(parseFloat(e.target.value))} />
                    <span className="param-hint">e.g. 0.10</span>
                  </div>
                  {mode === 'compare' && (
                    <div className="param-card">
                      <label className="param-label">Test Type</label>
                      <div className="toggle-row">
                        <button className={`toggle ${paired ? 'on' : ''}`} onClick={() => setPaired(p => !p)} />
                        <span className={`toggle-label ${paired ? 'on' : ''}`}>{paired ? 'Paired' : 'Independent'}</span>
                      </div>
                      <span className="param-hint">{paired ? 'Paired t-test' : "Welch's t-test"}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {status === 'error' && (
              <div className="error-box">
                <span>⚠</span>
                <div><strong>Analysis failed:</strong> {errorMsg}</div>
              </div>
            )}

            <button className="run-btn" disabled={!canRun} onClick={runAnalysis}>
              {mode === 'visualize'
                ? '▶ Visualize Data'
                : `▶ Run ${mode === 'single' ? 'Single' : 'Comparison'} Analysis`}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
