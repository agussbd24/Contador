import { useState, useEffect, useCallback } from 'react';
import { fetchSignal, fetchMarket, fetchHistory, checkHealth, fetchMarketOverview, fetchPriceHistory, SignalData, MarketData, MarketOverview } from './api';

const usd = (n: number) => n != null ? 'US$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
const ars = (n: number) => n != null ? '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 }) : '-';
const pct = (n: number) => n != null ? (n >= 0 ? '+' : '') + n.toFixed(2) + '%' : '-';
const arsShort = (n: number) => {
  if (n == null) return '-';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
};

function MiniChart({ prices, timestamps, color, dolar, timeRange }: {
  prices: number[]; timestamps: number[]; color: string; dolar: number; timeRange: number;
}) {
  if (!prices.length) return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>Cargando grafico...</div>;

  const pad = { top: 12, right: 60, bottom: 30, left: 10 };
  const W = 440;
  const H = 200;
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  const arsData = prices.map(v => v * dolar);
  const rawMin = Math.min(...arsData);
  const rawMax = Math.max(...arsData);
  const range = rawMax - rawMin || 1;
  const padding = range * 0.1;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const yRange = max - min;

  const pts = arsData.map((v, i) => ({
    x: pad.left + (i / Math.max(arsData.length - 1, 1)) * cw,
    y: pad.top + ch - ((v - min) / yRange) * ch,
  }));

  const linePts = pts.map(p => `${p.x},${p.y}`).join(' ');
  const fillPts = `${pts[0].x},${pad.top + ch} ${linePts} ${pts[pts.length - 1].x},${pad.top + ch}`;
  const last = pts[pts.length - 1];
  const currentPrice = arsData[arsData.length - 1];
  const isUp = arsData[arsData.length - 1] >= arsData[0];

  const timeLabels: { x: number; label: string }[] = [];
  if (timestamps.length > 1) {
    const count = Math.min(6, timestamps.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor((i / (count - 1)) * (timestamps.length - 1));
      const ts = timestamps[idx];
      const d = new Date(ts);
      let label = '';
      if (timeRange <= 1) label = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      else if (timeRange <= 7) label = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      else label = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
      timeLabels.push({ x: pad.left + (idx / Math.max(timestamps.length - 1, 1)) * cw, label });
    }
  }

  const fmtARS = (n: number) => {
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n.toFixed(0);
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <polygon points={fillPts} fill="url(#chartFill)" />

      <polyline points={linePts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {last && (
        <g>
          <circle cx={last.x} cy={last.y} r="4" fill={color} stroke="var(--bg)" strokeWidth="2" />
          <rect x={W - pad.right + 2} y={last.y - 10} width="52" height="20" rx="4" fill={color} />
          <text x={W - pad.right + 28} y={last.y + 3} fill="#000" fontSize="8" fontWeight="800" textAnchor="middle" fontFamily="Inter, sans-serif">
            {fmtARS(currentPrice)}
          </text>
        </g>
      )}

      {timeLabels.map((tl, i) => (
        <text key={i} x={tl.x} y={H - 8} fill="rgba(255,255,255,0.25)" fontSize="8" textAnchor="middle" fontFamily="Inter, sans-serif">{tl.label}</text>
      ))}
    </svg>
  );
}

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
  const [priceTimestamps, setPriceTimestamps] = useState<number[]>([]);
  const [timeRange, setTimeRange] = useState(7);
  const [loadingChart, setLoadingChart] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [sig, mkt, hist, h, ov] = await Promise.allSettled([
        fetchSignal(), fetchMarket(), fetchHistory(), checkHealth(), fetchMarketOverview(),
      ]);
      if (sig.status === 'fulfilled' && sig.value) setSignal(sig.value);
      if (mkt.status === 'fulfilled' && mkt.value) setMarket(mkt.value);
      if (ov.status === 'fulfilled' && ov.value) setOverview(ov.value);
      if (hist.status === 'fulfilled') setHistory(hist.value);
      if (h.status === 'fulfilled') setHealthy(h.value);
      setLastUpdate(new Date());
      if (sig.status === 'rejected' && mkt.status === 'rejected') setError('No se pudo conectar a la API');
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);

  const loadChart = useCallback(async (days: number) => {
    setLoadingChart(true);
    try {
      const result = await fetchPriceHistory(days);
      if (result.prices.length > 0) {
        setPriceHistory(result.prices);
        setPriceTimestamps(result.timestamps);
      }
    } catch {}
    setLoadingChart(false);
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 15000);
    return () => clearInterval(id);
  }, [loadData]);

  useEffect(() => {
    loadChart(timeRange);
    const chartId = setInterval(() => loadChart(timeRange), 300000);
    return () => clearInterval(chartId);
  }, [timeRange, loadChart]);

  const dBlue = market?.dolar?.blue || 1200;
  const solPrice = signal?.price ?? 0;
  const solARS = Math.round(solPrice * dBlue);
  const change24h = market?.ticker?.change_24h ?? 0;
  const isUp = change24h >= 0;

  const buyPrice = market?.exchanges?.fiwind?.ask || market?.exchanges?.bestBuy?.totalAsk || Math.round(solPrice * dBlue);
  const sellPrice = market?.exchanges?.fiwind?.bid || market?.exchanges?.bestSell?.totalBid || Math.round(solPrice * dBlue);
  const buyExchange = market?.exchanges?.bestBuy?.name || 'fiwind';
  const sellExchange = market?.exchanges?.bestSell?.name || 'fiwind';

  const isBuy = signal?.signal?.includes('BUY');

  if (loading && !signal) return (
    <div className="app">
      <div className="hero-skeleton">
        <div className="sk-circle" />
        <div className="sk-line w50" />
        <div className="sk-line w30" />
      </div>
      <div className="sk-chart" />
      <div className="sk-cards">
        <div className="sk-card" />
        <div className="sk-card" />
      </div>
    </div>
  );

  if (error && !signal) return (
    <div className="app">
      <div className="error-box">
        <div className="error-icon">!</div>
        <div className="error-title">Sin conexion</div>
        <div className="error-sub">{error}</div>
        <button className="btn-retry" onClick={loadData}>Reintentar</button>
      </div>
    </div>
  );

  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-left">
          <div className="sol-icon">S</div>
          <div>
            <div className="top-name">SOL</div>
            <div className="top-sub">Solana</div>
          </div>
        </div>
        <div className={`status-dot ${healthy ? 'online' : 'offline'}`} />
      </header>

      <section className="price-hero">
        <div className="price-row">
          <div className="price-big">{ars(solARS)}</div>
          <div className={`change-badge ${isUp ? 'up' : 'down'}`}>
            {isUp ? '\u25B2' : '\u25BC'} {pct(change24h)}
          </div>
        </div>
        <div className="price-sub">{usd(solPrice)}</div>
      </section>

      <nav className="time-tabs">
        {[{ d: 1, l: '24H' }, { d: 3, l: '3D' }, { d: 7, l: 'Semana' }, { d: 30, l: 'Mes' }, { d: 90, l: '3M' }].map(({ d, l }) => (
          <button key={d} className={`tab ${timeRange === d ? 'active' : ''}`} onClick={() => { setTimeRange(d); loadChart(d); }}>{l}</button>
        ))}
      </nav>

      <div className={`chart-wrap ${loadingChart ? 'dimmed' : ''}`}>
        <MiniChart prices={priceHistory} timestamps={priceTimestamps} color={isUp ? '#f0b90b' : '#ff4d6a'} dolar={dBlue} timeRange={timeRange} />
      </div>

      <div className="action-cards">
        <div className="action-card buy-card">
          <div className="action-label">Precio para comprar</div>
          <div className="action-price">{ars(buyPrice)}</div>
          <div className="action-sub">Fiwind</div>
        </div>
        <div className="action-card sell-card">
          <div className="action-label">Precio para vender</div>
          <div className="action-price">{ars(sellPrice)}</div>
          <div className="action-sub">Fiwind</div>
        </div>
      </div>

      <section className="info-section">
        <div className="info-title">Sobre SOL</div>
        <p className="info-text">
          Solana es una blockchain de alto rendimiento que utiliza Proof of History (PoH) para procesar miles de transacciones por segundo con comisiones minimas. Su token SOL se usa para staking, gobernanza y pagos de fees en la red.
        </p>
      </section>

      <section className="detail-grid">
        <div className="detail-item">
          <div className="detail-label">Market Cap</div>
          <div className="detail-val">{arsShort((market?.coingecko?.market_cap ?? 0) * dBlue / 1e9)}M</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Volumen 24h</div>
          <div className="detail-val">{arsShort((market?.ticker?.volume_24h ?? 0) * dBlue)}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">ATH</div>
          <div className="detail-val">{ars(Math.round((market?.coingecko?.ath ?? 0) * dBlue))}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Fear & Greed</div>
          <div className="detail-val">{signal?.fear_greed ?? market?.fear_greed?.value ?? '-'}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Dolar Blue</div>
          <div className="detail-val">{ars(dBlue)}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Dolar Oficial</div>
          <div className="detail-val">{ars(market?.dolar?.oficial ?? 0)}</div>
        </div>
      </section>

      {market?.exchanges && (
        <section className="exchanges-section">
          <div className="info-title">Comparar exchanges</div>
          <div className="exchange-header">
            <span>Exchange</span><span>Comprar</span><span>Vender</span>
          </div>
          {[
            { name: 'Fiwind', ask: market.exchanges.fiwind?.ask, bid: market.exchanges.fiwind?.bid },
            ...(market.exchanges.list || []).filter(e => e.name !== 'fiwind').slice(0, 6),
          ].filter(e => e.ask).map((e, i) => (
            <div className="exchange-row" key={i}>
              <span className="ex-name">{e.name}</span>
              <span className="ex-ask">{ars(e.ask!)}</span>
              <span className="ex-bid">{ars(e.bid!)}</span>
            </div>
          ))}
        </section>
      )}

      {signal?.signal !== 'HOLD' && (
        <section className="signal-section">
          <div className="signal-badge" data-type={signal.signal?.includes('BUY') ? 'buy' : 'sell'}>
            {signal.signal?.includes('BUY') ? '\u25B2' : '\u25BC'} {signal.signal?.replace('_', ' ')}
          </div>
          <div className="signal-conf">Confianza: {signal.confidence}%</div>
          <div className="signal-bar">
            <div className="signal-fill" style={{ width: `${signal.confidence}%`, background: signal.signal?.includes('BUY') ? '#00e49d' : '#ff4d6a' }} />
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="history-section">
          <div className="info-title">Historial</div>
          <div className="history-list">
            {history.slice(0, 8).map((h, i) => (
              <div className="history-row" key={i}>
                <span className="hist-time">{new Date(h.time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className={`hist-sig ${h.signal?.includes('BUY') ? 'buy' : h.signal?.includes('SELL') ? 'sell' : 'hold'}`}>
                  {h.signal?.replace('_', ' ')}
                </span>
                <span className="hist-conf">{h.confidence}%</span>
                <span className="hist-price">{ars(Math.round(h.price * dBlue))}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="footer">
        {lastUpdate && <div className="footer-time">Actualizado: {lastUpdate.toLocaleTimeString('es-AR')}</div>}
        <div className="footer-copy">Solana Quant v2.0 — Precios en pesos argentinos</div>
      </footer>
    </div>
  );
}

export default App;
