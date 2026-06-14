import { useState, useEffect, useCallback } from 'react';
import { fetchSignal, fetchMarket, fetchHistory, checkHealth, SignalData, MarketData } from './api';

function App() {
  const [signal, setSignal] = useState<SignalData | null>(null);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [healthy, setHealthy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sig, mkt, hist, h] = await Promise.all([
        fetchSignal(), fetchMarket(), fetchHistory(), checkHealth(),
      ]);
      setSignal(sig);
      setMarket(mkt);
      setHistory(hist);
      setHealthy(h);
      setLastUpdate(new Date());
    } catch (e: any) {
      setError(e.message);
      setHealthy(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const fmt = (n: number, d = 2) => n?.toFixed(d) ?? '-';
  const fmtUSD = (n: number) => 'US$' + n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '-';
  const fmtARS = (n: number) => '$' + n?.toLocaleString('es-AR', { maximumFractionDigits: 0 }) ?? '-';
  const dolarBlue = market?.dolar?.blue || 1200;

  const sigClass = (s: string) => s?.toLowerCase().replace('_', '') || 'hold';
  const sigIcon = (s: string) => {
    const map: Record<string, string> = { STRONG_BUY: '\u{1F4C8}', BUY: '\u{1F7E2}', ACCUMULATE: '\u{1F4E6}', HOLD: '\u26AA', DISTRIBUTE: '\u{1F4C9}', SELL: '\u{1F534}', STRONG_SELL: '\u{1F534}' };
    return map[s] || '\u26AA';
  };
  const sigLabel = (s: string) => {
    const map: Record<string, string> = { STRONG_BUY: 'COMPRA FUERTE', BUY: 'COMPRA', ACCUMULATE: 'ACUMULAR', HOLD: 'MANTENER', DISTRIBUTE: 'DISTRIBUIR', SELL: 'VENTA', STRONG_SELL: 'VENTA FUERTE' };
    return map[s] || s;
  };

  if (loading && !signal) return (
    <div className="app">
      <div className="loading">
        <div className="loading-spinner" />
        <div className="loading-text">Conectando a Solana Quant...</div>
      </div>
    </div>
  );

  if (error && !signal) return (
    <div className="app">
      <div className="error-box">
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>{'\u{1F50C}'}</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Error de conexion</div>
        <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>{error}</div>
        <button className="retry-btn" onClick={loadData}>Reintentar</button>
      </div>
    </div>
  );

  return (
    <div className="app">
      {/* ─── HEADER ─── */}
      <header className="header">
        <div className="header-top">
          <div className="header-icon">{'\u26A1'}</div>
          <h1>Solana Quant</h1>
        </div>
        <div className="subtitle">Motor de señales SOL 24/7 \u2014 Precios en pesos argentinos</div>
        <div className="header-bottom">
          <div className={`status-pill ${healthy ? 'online' : 'offline'}`}>
            <span className="dot" />
            {healthy ? 'Online' : 'Offline'}
          </div>
          <div className="dolar-pill">
            {'\u{1F1E6}\u{1F1F7}'} Blue: ${dolarBlue.toLocaleString()}
          </div>
          {lastUpdate && (
            <div className="update-pill">
              Actualizado: {lastUpdate.toLocaleTimeString('es-AR')}
            </div>
          )}
        </div>
      </header>

      {signal && (
        <>
          {/* ─── ROW 1: PRECIO + SEÑAL + RIESGO ─── */}
          <div className="grid">
            {/* PRECIO */}
            <div className="card col-5">
              <div className="card-glow" />
              <div className="card-header">
                <span className="card-title">SOL / USDT</span>
                <span className="card-badge">Binance</span>
              </div>
              <div className="price-main">{fmtUSD(signal.price)}</div>
              <div className="price-ars">{fmtARS(Math.round(signal.price * dolarBlue))} ARS</div>
              <div className={`price-change ${(market?.ticker?.change_24h ?? 0) >= 0 ? 'up' : 'down'}`}>
                {(market?.ticker?.change_24h ?? 0) >= 0 ? '\u25B2' : '\u25BC'} {fmt(Math.abs(market?.ticker?.change_24h ?? 0))}%
                <span style={{ opacity: 0.6, marginLeft: 4 }}>24h</span>
              </div>
              <div className="price-stats">
                <div className="price-stat">
                  <div className="price-stat-label">Max 24h</div>
                  <div className="price-stat-value">{fmtUSD(market?.ticker?.high_24h ?? 0)}</div>
                </div>
                <div className="price-stat">
                  <div className="price-stat-label">Min 24h</div>
                  <div className="price-stat-value">{fmtUSD(market?.ticker?.low_24h ?? 0)}</div>
                </div>
                <div className="price-stat">
                  <div className="price-stat-label">Volumen</div>
                  <div className="price-stat-value">${((market?.ticker?.volume_24h ?? 0) / 1e9).toFixed(2)}B</div>
                </div>
              </div>
            </div>

            {/* SEÑAL */}
            <div className="card col-4">
              <div className="card-glow" />
              <div className="card-header">
                <span className="card-title">Señal</span>
                <span className="card-badge">IA</span>
              </div>
              <div className="signal-display">
                <div className={`signal-icon ${sigClass(signal.signal)}`}>{sigIcon(signal.signal)}</div>
                <div className={`signal-text ${sigClass(signal.signal)}`}>
                  <h3>{sigLabel(signal.signal)}</h3>
                </div>
              </div>
              <div className="confidence-section">
                <div className="confidence-header">
                  <span className="confidence-label">Confianza</span>
                  <span className="confidence-value" style={{
                    color: signal.confidence >= 70 ? 'var(--accent-green)' :
                           signal.confidence >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)'
                  }}>{signal.confidence}%</span>
                </div>
                <div className="confidence-bar">
                  <div className="confidence-fill" style={{
                    width: `${signal.confidence}%`,
                    background: signal.confidence >= 70 ? 'var(--accent-green)' :
                                signal.confidence >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)',
                  }} />
                </div>
              </div>
              <div className="fear-greed-badge">
                {'\u{1F4AF}'} Fear & Greed: {signal.fear_greed ?? market?.fear_greed?.value ?? '-'}
                <span style={{ opacity: 0.6 }}>({market?.fear_greed?.classification ?? '-'})</span>
              </div>
            </div>

            {/* RIESGO */}
            <div className="card col-3">
              <div className="card-glow" />
              <div className="card-header">
                <span className="card-title">Gestion de Riesgo</span>
              </div>
              <div className="risk-grid">
                <div className="risk-box">
                  <div className="risk-box-label">Stop Loss</div>
                  <div className="risk-box-usd" style={{ color: 'var(--accent-red)' }}>
                    {fmtUSD(signal.risk_levels?.stop_loss ?? 0)}
                  </div>
                  <div className="risk-box-ars">{fmtARS(Math.round((signal.risk_levels?.stop_loss ?? 0) * dolarBlue))}</div>
                </div>
                <div className="risk-box">
                  <div className="risk-box-label">Take Profit</div>
                  <div className="risk-box-usd" style={{ color: 'var(--accent-green)' }}>
                    {fmtUSD(signal.risk_levels?.take_profit ?? 0)}
                  </div>
                  <div className="risk-box-ars">{fmtARS(Math.round((signal.risk_levels?.take_profit ?? 0) * dolarBlue))}</div>
                </div>
                <div className="risk-box">
                  <div className="risk-box-label">R:R</div>
                  <div className="risk-box-usd" style={{ color: 'var(--accent-purple)' }}>
                    {fmt(signal.risk_levels?.rr_ratio ?? 0)}x
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── ROW 2: INDICADORES ─── */}
          <div className="grid">
            <div className="card col-4">
              <div className="card-glow" />
              <div className="card-header">
                <span className="card-title">Score Breakdown</span>
              </div>
              {signal.breakdown && Object.entries(signal.breakdown).map(([k, v]) => (
                <div className="indicator-row" key={k}>
                  <span className="indicator-label">{k.charAt(0).toUpperCase() + k.slice(1)}</span>
                  <span className={`indicator-value ${(v as number) >= 70 ? 'buy' : (v as number) <= 30 ? 'sell' : 'neutral'}`}>
                    {fmt(v as number)}%
                  </span>
                </div>
              ))}
            </div>

            <div className="card col-4">
              <div className="card-glow" />
              <div className="card-header">
                <span className="card-title">Indicadores Tecnicos</span>
              </div>
              {signal.technical?.indicators && Object.entries(signal.technical.indicators).slice(0, 8).map(([k, v]) => (
                <div className="indicator-row" key={k}>
                  <span className="indicator-label">{k.replace(/_/g, ' ').toUpperCase()}</span>
                  <span className={`indicator-value ${signal.technical.interpretation?.[k]?.includes('BUY') ? 'buy' : signal.technical.interpretation?.[k]?.includes('SELL') ? 'sell' : 'neutral'}`}>
                    {typeof v === 'number' ? fmt(v) : String(v)}
                  </span>
                </div>
              ))}
            </div>

            <div className="card col-4">
              <div className="card-glow" />
              <div className="card-header">
                <span className="card-title">On-Chain & Sentimiento</span>
              </div>
              {signal.onchain?.metrics && Object.entries(signal.onchain.metrics).slice(0, 4).map(([k, v]) => (
                <div className="indicator-row" key={k}>
                  <span className="indicator-label">{k.replace(/_/g, ' ')}</span>
                  <span className={`indicator-value ${signal.onchain.interpretation?.[k]?.includes('Bullish') ? 'buy' : signal.onchain.interpretation?.[k]?.includes('Bearish') ? 'sell' : 'neutral'}`}>
                    {typeof v === 'number' ? fmt(v as number) : String(v)}
                  </span>
                </div>
              ))}
              {signal.sentiment?.interpretation && (
                <div className="indicator-row">
                  <span className="indicator-label">Sentimiento</span>
                  <span className="indicator-value neutral">{fmt(signal.sentiment.score * 100)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* ─── ROW 3: HISTORIAL ─── */}
          {history.length > 0 && (
            <div className="grid">
              <div className="card col-12">
                <div className="card-glow" />
                <div className="card-header">
                  <span className="card-title">Historial de Senales</span>
                  <span className="card-badge">{history.length} senales</span>
                </div>
                <div className="history-list">
                  {history.slice(0, 15).map((h, i) => (
                    <div className="history-item" key={i}>
                      <span className="history-time">{new Date(h.time).toLocaleString('es-AR')}</span>
                      <span className={`history-signal signal-icon ${sigClass(h.signal)}`} style={{ padding: '3px 8px', fontSize: '0.6rem' }}>
                        {sigLabel(h.signal)}
                      </span>
                      <span className="history-conf">{fmt(h.confidence)}%</span>
                      <span className="history-price">
                        {fmtUSD(h.price)}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: 4 }}>/ {fmtARS(Math.round(h.price * dolarBlue))}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="footer">
        Solana Quant Platform v2.0 \u2014 Cloudflare Workers \u2014 Alertas por Telegram \u2014 Precios en ARS
      </div>
    </div>
  );
}

export default App;
