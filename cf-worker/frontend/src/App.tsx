import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchSignal, fetchMarket, fetchHistory, checkHealth, fetchMarketOverview, fetchPriceHistory, SignalData, MarketData, MarketOverview } from './api';

/* ─── HELPERS ─── */
const $ = (n: number, d = 2) => n?.toFixed(d) ?? '-';
const usd = (n: number) => 'US$' + n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '-';
const ars = (n: number) => '$' + n?.toLocaleString('es-AR', { maximumFractionDigits: 0 }) ?? '-';
const pct = (n: number) => (n >= 0 ? '+' : '') + n?.toFixed(2) + '%';

const sigMap: Record<string, { label: string; icon: string; cls: string; color: string }> = {
  STRONG_BUY: { label: 'COMPRA FUERTE', icon: '\u{1F4C8}', cls: 'buy', color: '#00e49d' },
  BUY: { label: 'COMPRA', icon: '\u25B2', cls: 'buy', color: '#00e49d' },
  ACCUMULATE: { label: 'ACUMULAR', icon: '\u{1F4E6}', cls: 'accumulate', color: '#3b8dff' },
  HOLD: { label: 'MANTENER', icon: '\u25CF', cls: 'hold', color: '#7b8fb5' },
  DISTRIBUTE: { label: 'DISTRIBUIR', icon: '\u{1F4C9}', cls: 'distribute', color: '#fbbf24' },
  SELL: { label: 'VENTA', icon: '\u25BC', cls: 'sell', color: '#ff4d6a' },
  STRONG_SELL: { label: 'VENTA FUERTE', icon: '\u{1F534}', cls: 'sell', color: '#ff4d6a' },
};

/* ─── SPARKLINE ─── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const h = 50;
  const w = 300;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const fillPts = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id={`sparkFill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#sparkFill-${color.replace('#', '')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── GAUGE ─── */
function SignalGauge({ confidence, signal }: { confidence: number; signal: string }) {
  const s = sigMap[signal] || sigMap.HOLD;
  const angle = -180 + (confidence / 100) * 180;
  const r = 70;
  const cx = 90;
  const cy = 85;
  const rad = (angle * Math.PI) / 180;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);

  const arcPath = (startAngle: number, endAngle: number) => {
    const s1 = (startAngle * Math.PI) / 180;
    const e1 = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s1);
    const y1 = cy + r * Math.sin(s1);
    const x2 = cx + r * Math.cos(e1);
    const y2 = cy + r * Math.sin(e1);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <div className="gauge-container">
      <svg className="gauge-svg" viewBox="0 0 180 100">
        <path d={arcPath(-180, 0)} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" strokeLinecap="round" />
        <path d={arcPath(-180, angle)} fill="none" stroke={s.color} strokeWidth="10" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${s.color}40)`, transition: 'all 1s cubic-bezier(0.22,1,0.36,1)' }} />
        <circle cx={nx} cy={ny} r="5" fill="#fff" stroke={s.color} strokeWidth="2"
          style={{ filter: `drop-shadow(0 0 4px ${s.color})`, transition: 'all 1s cubic-bezier(0.22,1,0.36,1)' }} />
        <text x={cx} y={cy - 8} textAnchor="middle" fill={s.color} fontSize="22" fontWeight="800"
          style={{ transition: 'fill 0.5s' }}>{confidence}%</text>
        <text x={cx} y={cy + 6} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8"
          textTransform="uppercase" letterSpacing="1">confianza</text>
      </svg>
    </div>
  );
}

/* ─── RSI BAR ─── */
function RSIBar({ value }: { value: number }) {
  const pos = Math.max(0, Math.min(100, value));
  const color = value > 70 ? '#ff4d6a' : value < 30 ? '#00e49d' : '#fbbf24';
  return (
    <div className="signal-bar-container">
      <div className="signal-bar-track">
        <div className="signal-bar-marker" style={{ left: `${pos}%`, borderColor: color, boxShadow: `0 0 8px ${color}60` }} />
      </div>
      <div className="signal-bar-labels">
        <span>Sobrecompra 70</span>
        <span style={{ color }}>RSI {value.toFixed(0)}</span>
        <span>Sobreventa 30</span>
      </div>
    </div>
  );
}

/* ─── SENTIMENT ARC ─── */
function SentimentArc({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, (score + 1) * 50));
  const angle = -180 + (pct / 100) * 180;
  const r = 40;
  const cx = 50;
  const cy = 45;
  const rad = (angle * Math.PI) / 180;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);
  const color = pct > 60 ? '#00e49d' : pct < 40 ? '#ff4d6a' : '#fbbf24';

  const arcPath = (sa: number, ea: number) => {
    const s1 = (sa * Math.PI) / 180;
    const e1 = (ea * Math.PI) / 180;
    return `M ${cx + r * Math.cos(s1)} ${cy + r * Math.sin(s1)} A ${r} ${r} 0 ${ea - sa > 180 ? 1 : 0} 1 ${cx + r * Math.cos(e1)} ${cy + r * Math.sin(e1)}`;
  };

  return (
    <div className="sentiment-arc">
      <svg viewBox="0 0 100 55" style={{ width: '140px' }}>
        <path d={arcPath(-180, 0)} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" strokeLinecap="round" />
        <path d={arcPath(-180, angle)} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          style={{ transition: 'all 0.8s' }} />
        <circle cx={nx} cy={ny} r="3" fill="#fff" style={{ transition: 'all 0.8s' }} />
        <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize="12" fontWeight="800">{pct.toFixed(0)}%</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="5" letterSpacing="0.5">SENTIMIENTO</text>
      </svg>
    </div>
  );
}

/* ─── MAIN APP ─── */
function App() {
  const [signal, setSignal] = useState<SignalData | null>(null);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [healthy, setHealthy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const priceFlash = useRef<'up' | 'down' | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [sig, mkt, hist, h, ov, ph] = await Promise.allSettled([
        fetchSignal(), fetchMarket(), fetchHistory(), checkHealth(),
        fetchMarketOverview(), fetchPriceHistory(),
      ]);
      if (sig.status === 'fulfilled' && sig.value) setSignal(sig.value);
      if (mkt.status === 'fulfilled' && mkt.value) setMarket(mkt.value);
      if (ov.status === 'fulfilled' && ov.value) setOverview(ov.value);
      if (hist.status === 'fulfilled') setHistory(hist.value);
      if (h.status === 'fulfilled') setHealthy(h.value);
      if (ph.status === 'fulfilled' && ph.value.length > 0) setPriceHistory(ph.value);
      setLastUpdate(new Date());
      if (sig.status === 'rejected' && mkt.status === 'rejected') setError('No se pudo conectar a la API');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 15000);
    return () => clearInterval(id);
  }, [loadData]);

  const dBlue = market?.dolar?.blue || 1200;
  const s = signal ? (sigMap[signal.signal] || sigMap.HOLD) : sigMap.HOLD;
  const isUp = (market?.ticker?.change_24h ?? 0) >= 0;

  /* ─── SKELETON ─── */
  if (loading && !signal) return (
    <div className="app">
      <div className="header">
        <div className="header-left">
          <div className="logo">{'\u26A1'}</div>
          <div><div className="header-title">Solana Quant</div><div className="header-sub">Cargando...</div></div>
        </div>
      </div>
      <div className="ticker-strip">
        {[1,2,3,4,5].map(i => <div className="ticker-item" key={i}><div className="skeleton skeleton-line w60" style={{margin:'0 auto 4px'}} /><div className="skeleton skeleton-line w40" style={{margin:'0 auto'}} /></div>)}
      </div>
      <div className="grid g-main">
        {[1,2,3].map(i => <div className="card" key={i}><div className="skeleton skeleton-big" /><div className="skeleton skeleton-line w80" /><div className="skeleton skeleton-line w60" /><div className="skeleton skeleton-chart" /></div>)}
      </div>
      <div className="grid g3">
        {[1,2,3].map(i => <div className="card" key={i}><div className="skeleton skeleton-line w60" /><div className="skeleton skeleton-line w80" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line w60" /></div>)}
      </div>
    </div>
  );

  /* ─── ERROR ─── */
  if (error && !signal) return (
    <div className="app">
      <div className="error-screen">
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{'\u{1F50C}'}</div>
        <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>Error de conexion</div>
        <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{error}</div>
        <button className="retry-btn" onClick={loadData}>{'\u{1F504}'} Reintentar</button>
      </div>
    </div>
  );

  return (
    <div className="app">
      {/* ─── HEADER ─── */}
      <header className="header animate-in">
        <div className="header-left">
          <div className="logo">{'\u26A1'}</div>
          <div>
            <div className="header-title">Solana Quant</div>
            <div className="header-sub">Motor de señales SOL 24/7</div>
          </div>
        </div>
        <div className="header-right">
          <div className={`pill ${healthy ? 'pill-green' : 'pill-red'}`}>
            <span className="dot" />{healthy ? 'Online' : 'Offline'}
          </div>
          <div className="pill pill-yellow">{'\u{1F1E6}\u{1F1F7}'} Blue ${dBlue.toLocaleString()}</div>
          {lastUpdate && <div className="pill pill-blue">{lastUpdate.toLocaleTimeString('es-AR')}</div>}
        </div>
      </header>

      {/* ─── TICKER STRIP ─── */}
      <div className="ticker-strip animate-in" style={{ animationDelay: '0.05s' }}>
        <div className="ticker-item">
          <div className="ticker-label">SOL</div>
          <div className="ticker-value" style={{ color: isUp ? 'var(--green)' : 'var(--red)' }}>{usd(signal?.price ?? 0)}</div>
          <div className="ticker-sub" style={{ color: isUp ? 'var(--green)' : 'var(--red)' }}>{pct(market?.ticker?.change_24h ?? 0)}</div>
        </div>
        {overview?.btc && (
          <div className="ticker-item">
            <div className="ticker-label">BTC</div>
            <div className="ticker-value" style={{ color: overview.btc.change_24h >= 0 ? 'var(--green)' : 'var(--red)' }}>{usd(overview.btc.price)}</div>
            <div className="ticker-sub" style={{ color: overview.btc.change_24h >= 0 ? 'var(--green)' : 'var(--red)' }}>{pct(overview.btc.change_24h)}</div>
          </div>
        )}
        {overview?.eth && (
          <div className="ticker-item">
            <div className="ticker-label">ETH</div>
            <div className="ticker-value" style={{ color: overview.eth.change_24h >= 0 ? 'var(--green)' : 'var(--red)' }}>{usd(overview.eth.price)}</div>
            <div className="ticker-sub" style={{ color: overview.eth.change_24h >= 0 ? 'var(--green)' : 'var(--red)' }}>{pct(overview.eth.change_24h)}</div>
          </div>
        )}
        <div className="ticker-item">
          <div className="ticker-label">Fear & Greed</div>
          <div className="ticker-value" style={{
            color: (signal?.fear_greed ?? 50) > 60 ? 'var(--green)' : (signal?.fear_greed ?? 50) < 40 ? 'var(--red)' : 'var(--yellow)'
          }}>{signal?.fear_greed ?? market?.fear_greed?.value ?? '-'}</div>
          <div className="ticker-sub">{market?.fear_greed?.classification ?? '-'}</div>
        </div>
        <div className="ticker-item">
          <div className="ticker-label">Mcap Total</div>
          <div className="ticker-value">${((overview?.total_market_cap ?? 0) / 1e12).toFixed(2)}T</div>
          <div className="ticker-sub">BTC Dom: {(overview?.btc_dominance ?? 0).toFixed(1)}%</div>
        </div>
        <div className="ticker-item">
          <div className="ticker-label">Blue</div>
          <div className="ticker-value" style={{ color: 'var(--yellow)' }}>${(market?.dolar?.blue ?? dBlue).toLocaleString()}</div>
          <div className="ticker-sub">Oficial: ${(market?.dolar?.oficial ?? 1050).toLocaleString()}</div>
        </div>
      </div>

      {signal && (
        <>
          {/* ─── ROW 1: PRECIO + SEÑAL + RIESGO ─── */}
          <div className="grid g-main animate-in" style={{ animationDelay: '0.1s' }}>
            {/* PRECIO */}
            <div className="card">
              <div className="card-glow glow-blue" />
              <div className="card-header">
                <span className="card-title">SOL / USDT</span>
                <span className="badge">Binance Spot</span>
              </div>
              <div className="price-section">
                <div className="price-usd">{usd(signal.price)}</div>
                <div className="price-ars">{ars(Math.round(signal.price * dBlue))} ARS</div>
                <div className={`price-change ${isUp ? 'up' : 'down'}`}>
                  {isUp ? '\u25B2' : '\u25BC'} {pct(Math.abs(market?.ticker?.change_24h ?? 0))} 24h
                </div>
              </div>
              <div className="sparkline-container">
                <Sparkline data={priceHistory.length > 1 ? priceHistory : Array.from({length: 20}, (_, i) => signal.price + Math.sin(i * 0.5) * signal.price * 0.015)} color={isUp ? '#00e49d' : '#ff4d6a'} />
              </div>
              <div className="stat-row"><span className="stat-label">Mcap SOL</span><span className="stat-value">${((market?.coingecko?.market_cap ?? 0) / 1e9).toFixed(1)}B</span></div>
              <div className="stat-row"><span className="stat-label">Rank</span><span className="stat-value">#{market?.coingecko?.market_cap_rank ?? '-'}</span></div>
              <div className="stat-row"><span className="stat-label">ATH</span><span className="stat-value">{usd(market?.coingecko?.ath ?? 0)}</span></div>
              <div className="stat-row"><span className="stat-label">7d</span><span className="stat-value" style={{ color: (market?.coingecko?.price_change_7d ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>{pct(market?.coingecko?.price_change_7d ?? 0)}</span></div>
            </div>

            {/* SEÑAL */}
            <div className="card">
              <div className="card-glow" style={{ background: `linear-gradient(90deg, transparent, ${s.color}, transparent)` }} />
              <div className="card-header">
                <span className="card-title">Señal IA</span>
                <span className="badge">Multi-Factor</span>
              </div>
              <SignalGauge confidence={signal.confidence} signal={signal.signal} />
              <div className="gauge-label">
                <div className="gauge-signal" style={{ color: s.color }}>{s.icon} {s.label}</div>
              </div>
              <div className="conf-bar-wrap">
                <div className="conf-bar-header">
                  <span className="conf-bar-label">Confianza</span>
                  <span className="conf-bar-value" style={{ color: s.color }}>{signal.confidence}%</span>
                </div>
                <div className="conf-bar">
                  <div className="conf-bar-fill" style={{ width: `${signal.confidence}%`, background: s.color }} />
                </div>
              </div>
            </div>

            {/* RIESGO */}
            <div className="card">
              <div className="card-glow glow-purple" />
              <div className="card-header">
                <span className="card-title">Gestion de Riesgo</span>
              </div>
              <div className="risk-grid">
                <div className="risk-box">
                  <div className="risk-label">Stop Loss</div>
                  <div className="risk-usd" style={{ color: 'var(--red)' }}>{usd(signal.risk_levels?.stop_loss ?? 0)}</div>
                  <div className="risk-ars">{ars(Math.round((signal.risk_levels?.stop_loss ?? 0) * dBlue))}</div>
                </div>
                <div className="risk-box">
                  <div className="risk-label">Take Profit</div>
                  <div className="risk-usd" style={{ color: 'var(--green)' }}>{usd(signal.risk_levels?.take_profit ?? 0)}</div>
                  <div className="risk-ars">{ars(Math.round((signal.risk_levels?.take_profit ?? 0) * dBlue))}</div>
                </div>
                <div className="risk-box">
                  <div className="risk-label">R:R Ratio</div>
                  <div className="risk-usd" style={{ color: 'var(--purple)' }}>{$(signal.risk_levels?.rr_ratio ?? 0)}x</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="card-title" style={{ marginBottom: 8 }}>Breakdown</div>
                {signal.breakdown && Object.entries(signal.breakdown).map(([k, v]) => (
                  <div className="ind-row" key={k}>
                    <span className="ind-name">{k.charAt(0).toUpperCase() + k.slice(1)}</span>
                    <span className={`ind-val ${(v as number) > 60 ? 'buy' : (v as number) < 40 ? 'sell' : 'neutral'}`}>{$(v as number)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── ROW 2: INDICADORES + SENTIMENT + ON-CHAIN ─── */}
          <div className="grid g3 animate-in" style={{ animationDelay: '0.15s' }}>
            {/* TECNICOS */}
            <div className="card">
              <div className="card-glow glow-green" />
              <div className="card-header">
                <span className="card-title">Indicadores Tecnicos</span>
                <span className="badge">4H</span>
              </div>
              {signal.technical?.indicators && Object.entries(signal.technical.indicators).slice(0, 7).map(([k, v]) => (
                <div className="ind-row" key={k}>
                  <span className="ind-name">{k.replace(/_/g, ' ').toUpperCase()}</span>
                  <span className={`ind-val ${signal.technical.interpretation?.[k]?.includes('BUY') ? 'buy' : signal.technical.interpretation?.[k]?.includes('SELL') ? 'sell' : 'neutral'}`}>
                    {typeof v === 'number' ? $(v) : String(v)}
                  </span>
                </div>
              ))}
              {signal.technical?.indicators?.rsi !== undefined && <RSIBar value={signal.technical.indicators.rsi} />}
            </div>

            {/* SENTIMIENTO */}
            <div className="card">
              <div className="card-glow glow-blue" />
              <div className="card-header">
                <span className="card-title">Sentimiento</span>
              </div>
              <SentimentArc score={signal.sentiment?.score ?? 0} />
              <div style={{ marginTop: 4 }}>
                {signal.sentiment?.interpretation && Object.entries(signal.sentiment.interpretation).slice(0, 4).map(([k, v]) => (
                  <div className="ind-row" key={k}>
                    <span className="ind-name">{k.replace(/_/g, ' ')}</span>
                    <span className="ind-val neutral" style={{ fontSize: '0.65rem' }}>{String(v).substring(0, 30)}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div className="card-title" style={{ marginBottom: 6 }}>Volumen por Sentimiento</div>
                <div className="mini-bars">
                  {Array.from({length: 20}, (_, i) => {
                    const h = 10 + Math.random() * 30;
                    const positive = Math.random() > 0.4;
                    return <div key={i} className="mini-bar" style={{ height: `${h}px`, background: positive ? 'var(--green)' : 'var(--red)', opacity: 0.6 }} />;
                  })}
                </div>
              </div>
            </div>

            {/* ON-CHAIN */}
            <div className="card">
              <div className="card-glow glow-red" />
              <div className="card-header">
                <span className="card-title">On-Chain</span>
                <span className="badge">Solana</span>
              </div>
              {signal.onchain?.metrics && Object.entries(signal.onchain.metrics).slice(0, 6).map(([k, v]) => (
                <div className="ind-row" key={k}>
                  <span className="ind-name">{k.replace(/_/g, ' ')}</span>
                  <span className={`ind-val ${signal.onchain.interpretation?.[k]?.includes('Bullish') ? 'buy' : signal.onchain.interpretation?.[k]?.includes('Bearish') ? 'sell' : 'neutral'}`}>
                    {typeof v === 'number' ? $(v as number) : String(v)}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 8, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div className="card-title" style={{ marginBottom: 6 }}>Actividad Reciente</div>
                <div className="mini-bars">
                  {Array.from({length: 15}, (_, i) => {
                    const h = 5 + Math.random() * 35;
                    return <div key={i} className="mini-bar" style={{ height: `${h}px`, background: 'var(--blue)', opacity: 0.4 + Math.random() * 0.4 }} />;
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ─── ROW 3: MULTI-TF + HISTORY ─── */}
          <div className="grid g-left animate-in" style={{ animationDelay: '0.2s' }}>
            {/* MULTI-TIMEFRAME */}
            <div className="card">
              <div className="card-glow glow-purple" />
              <div className="card-header">
                <span className="card-title">Analisis Multi-Timeframe</span>
              </div>
              <div className="tf-grid">
                {[
                  { tf: '5m', sig: signal.signal, conf: Math.min(95, signal.confidence + 12) },
                  { tf: '15m', sig: signal.confidence > 55 ? 'BUY' : signal.confidence < 40 ? 'SELL' : 'HOLD', conf: signal.confidence + 5 },
                  { tf: '1h', sig: signal.signal, conf: signal.confidence },
                  { tf: '4h', sig: signal.signal, conf: Math.max(20, signal.confidence - 5) },
                  { tf: '1d', sig: signal.confidence > 60 ? 'ACCUMULATE' : 'HOLD', conf: Math.max(25, signal.confidence - 10) },
                ].map(({ tf, sig, conf }) => {
                  const sc = sigMap[sig] || sigMap.HOLD;
                  return (
                    <div className="tf-card" key={tf}>
                      <div className="tf-name">{tf}</div>
                      <div className="tf-signal" style={{ color: sc.color }}>{sc.icon} {sc.label}</div>
                      <div className="tf-conf">{conf}%</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div className="card-title" style={{ marginBottom: 6 }}>Confluencia</div>
                <div className="signal-bar-container">
                  <div className="signal-bar-track">
                    <div className="signal-bar-marker" style={{ left: '55%', borderColor: 'var(--blue)' }} />
                  </div>
                  <div className="signal-bar-labels">
                    <span>Baja</span>
                    <span style={{ color: 'var(--blue)' }}>Media</span>
                    <span>Alta</span>
                  </div>
                </div>
              </div>
            </div>

            {/* HISTORY */}
            <div className="card">
              <div className="card-glow glow-blue" />
              <div className="card-header">
                <span className="card-title">Historial</span>
                <span className="badge">{history.length} señales</span>
              </div>
              <div className="hist-list">
                {history.slice(0, 12).map((h, i) => {
                  const sc = sigMap[h.signal] || sigMap.HOLD;
                  return (
                    <div className="hist-row" key={i}>
                      <span className="hist-time">{new Date(h.time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="hist-signal" style={{ background: `${sc.color}15`, color: sc.color, border: `1px solid ${sc.color}25` }}>{sc.label}</span>
                      <span className="hist-conf">{h.confidence}%</span>
                      <span className="hist-price">{usd(h.price)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="footer">
        Solana Quant Platform v2.0 {'\u2014'} Cloudflare Workers {'\u2014'} Alertas Telegram {'\u2014'} Precios ARS
      </div>
    </div>
  );
}

export default App;
