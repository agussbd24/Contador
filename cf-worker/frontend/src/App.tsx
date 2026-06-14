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
  const fmtPrice = (n: number) => '$' + n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '-';

  const signalClass = (s: string) => s?.toLowerCase().replace('_', '') || 'hold';

  if (loading && !signal) return <div className="app"><div className="loading">Connecting to Solana Quant...</div></div>;
  if (error && !signal) return <div className="app"><div className="error">Error: {error}<br /><button onClick={loadData} style={{ marginTop: 10, padding: '8px 16px', cursor: 'pointer' }}>Retry</button></div></div>;

  return (
    <div className="app">
      <header className="header">
        <h1>Solana Quant Platform</h1>
        <div className="subtitle">24/7 AI-Powered SOL Signal Engine</div>
        <div className={`status ${healthy ? 'online' : 'offline'}`}>
          <span className="dot" />
          {healthy ? 'System Online' : 'System Offline'}
        </div>
        {lastUpdate && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 6 }}>
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </header>

      {signal && (
        <>
          <div className="grid">
            <div className="card">
              <div className="card-header">
                <span className="card-title">SOL / USDT</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>24h</span>
              </div>
              <div className="price-display">{fmtPrice(signal.price)}</div>
              <div className={`price-change ${market?.ticker?.change_24h >= 0 ? 'positive' : 'negative'}`}>
                {market?.ticker?.change_24h >= 0 ? '↑' : '↓'} {fmt(Math.abs(market?.ticker?.change_24h ?? 0))}%
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Signal</span>
              </div>
              <div className={`signal-badge ${signalClass(signal.signal)}`}>
                {signal.signal.replace('_', ' ')}
              </div>
              <div style={{ marginTop: 10, fontSize: '0.9rem' }}>
                Confidence: <strong>{signal.confidence}%</strong>
              </div>
              <div className="confidence-bar">
                <div
                  className="confidence-fill"
                  style={{
                    width: `${signal.confidence}%`,
                    background: signal.confidence >= 70 ? 'var(--accent-green)' : signal.confidence >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)',
                  }}
                />
              </div>
              <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Fear & Greed: {signal.fear_greed ?? market?.fear_greed?.value ?? '-'} ({market?.fear_greed?.classification ?? '-'})
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Risk Levels</span>
              </div>
              <div className="risk-levels">
                <div className="risk-item">
                  <div className="label">Stop Loss</div>
                  <div className="value negative">{fmtPrice(signal.risk_levels?.stop_loss)}</div>
                </div>
                <div className="risk-item">
                  <div className="label">Take Profit</div>
                  <div className="value positive">{fmtPrice(signal.risk_levels?.take_profit)}</div>
                </div>
                <div className="risk-item">
                  <div className="label">R:R Ratio</div>
                  <div className="value" style={{ color: 'var(--accent-purple)' }}>{fmt(signal.risk_levels?.rr_ratio)}x</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Score Breakdown</span>
              </div>
              {signal.breakdown && Object.entries(signal.breakdown).map(([k, v]) => (
                <div className="indicator-row" key={k}>
                  <span className="indicator-label">{k.charAt(0).toUpperCase() + k.slice(1)}</span>
                  <span className={`indicator-value ${v >= 70 ? 'buy' : v <= 30 ? 'sell' : 'neutral'}`}>{fmt(v as number)}%</span>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Technical Indicators</span>
              </div>
              {signal.technical?.indicators && Object.entries(signal.technical.indicators).slice(0, 8).map(([k, v]) => (
                <div className="indicator-row" key={k}>
                  <span className="indicator-label">{k.replace(/_/g, ' ').toUpperCase()}</span>
                  <span className={`indicator-value ${signal.technical.interpretation?.[k]?.includes('BUY') ? 'buy' : signal.technical.interpretation?.[k]?.includes('SELL') ? 'sell' : 'neutral'}`}>
                    {typeof v === 'number' ? fmt(v) : v}
                  </span>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">On-Chain Metrics</span>
              </div>
              {signal.onchain?.metrics && Object.entries(signal.onchain.metrics).slice(0, 6).map(([k, v]) => (
                <div className="indicator-row" key={k}>
                  <span className="indicator-label">{k.replace(/_/g, ' ')}</span>
                  <span className={`indicator-value ${signal.onchain.interpretation?.[k]?.includes('Bullish') ? 'buy' : signal.onchain.interpretation?.[k]?.includes('Bearish') ? 'sell' : 'neutral'}`}>
                    {typeof v === 'number' ? fmt(v as number) : String(v)}
                  </span>
                </div>
              ))}
              {signal.sentiment?.interpretation && (
                <>
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: '0.8rem' }}>
                    <strong>Sentiment: {fmt(signal.sentiment.score * 100)}%</strong>
                    <br />
                    <span style={{ color: 'var(--text-secondary)' }}>{signal.sentiment.interpretation?.overall}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {history.length > 0 && (
            <div className="grid">
              <div className="card full-width">
                <div className="card-header">
                  <span className="card-title">Signal History</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{history.length} signals</span>
                </div>
                <div className="history-list">
                  {history.slice(0, 20).map((h, i) => (
                    <div className="history-item" key={i}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {new Date(h.time).toLocaleString()}
                      </span>
                      <span className={`signal-badge ${signalClass(h.signal)}`} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
                        {h.signal}
                      </span>
                      <span>{fmt(h.confidence)}%</span>
                      <span>{fmtPrice(h.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
        Solana Quant Platform v2.0 — Cloudflare Workers — Alerts via Telegram
      </div>
    </div>
  );
}

export default App;
