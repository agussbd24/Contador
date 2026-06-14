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
  const fmtUSD = (n: number) => 'US$' + n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '-';
  const fmtARS = (n: number) => '$' + n?.toLocaleString('es-AR', { maximumFractionDigits: 0 }) ?? '-';
  const fmtPrice = (n: number, dolar?: number) => {
    const ars = dolar ? Math.round(n * dolar) : Math.round(n * 1200);
    return (
      <>
        <div style={{ fontSize: '1.4rem' }}>{fmtUSD(n)}</div>
        <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: 2 }}>{fmtARS(ars)} ARS</div>
      </>
    );
  };

  const signalClass = (s: string) => s?.toLowerCase().replace('_', '') || 'hold';

  if (loading && !signal) return <div className="app"><div className="loading">Conectando a Solana Quant...</div></div>;
  if (error && !signal) return <div className="app"><div className="error">Error: {error}<br /><button onClick={loadData} style={{ marginTop: 10, padding: '8px 16px', cursor: 'pointer' }}>Reintentar</button></div></div>;

  return (
    <div className="app">
      <header className="header">
        <h1>Solana Quant Platform</h1>
        <div className="subtitle">24/7 Señales de SOL con precios en pesos argentinos</div>
        <div className={`status ${healthy ? 'online' : 'offline'}`}>
          <span className="dot" />
          {healthy ? 'Sistema Online' : 'Sistema Offline'}
        </div>
        {lastUpdate && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 6 }}>
            Última actualización: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
        {market?.dolar?.blue && (
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-yellow)', marginTop: 4 }}>
            Dólar Blue: ${market.dolar.blue.toLocaleString()} ARS
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
              <div className="price-display">{fmtPrice(signal.price, market?.dolar?.blue)}</div>
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
                  <div className="label">Stop Loss (USD)</div>
                  <div className="value negative">{fmtUSD(signal.risk_levels?.stop_loss)}</div>
                  <div className="label" style={{ marginTop: 4 }}>{fmtARS(signal.ars?.stop_loss)} ARS</div>
                </div>
                <div className="risk-item">
                  <div className="label">Take Profit (USD)</div>
                  <div className="value positive">{fmtUSD(signal.risk_levels?.take_profit)}</div>
                  <div className="label" style={{ marginTop: 4 }}>{fmtARS(signal.ars?.take_profit)} ARS</div>
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
                      <span>{fmtUSD(h.price)} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>/ {fmtARS(Math.round(h.price * (market?.dolar?.blue || 1200)))} ARS</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
        Solana Quant Platform v2.0 — Cloudflare Workers — Alertas por Telegram — Precios en ARS
      </div>
    </div>
  );
}

export default App;
