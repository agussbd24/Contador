import React, { useState, useEffect } from 'react'

const API_URL = ''

export default function Dashboard() {
  const [signal, setSignal] = useState(null)
  const [price, setPrice] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    try {
      const [signalRes, priceRes, healthRes] = await Promise.all([
        fetch(`${API_URL}/signal`),
        fetch(`${API_URL}/price`),
        fetch(`${API_URL}/health`),
      ])
      const signalData = await signalRes.json()
      const priceData = await priceRes.json()
      const healthData = await healthRes.json()

      setSignal(signalData)
      setPrice(priceData)
      setHealth(healthData)
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (loading) return <LoadingScreen />
  if (error) return <ErrorScreen error={error} />

  const signalColor = {
    STRONG_BUY: '#00ff88',
    BUY: '#4ade80',
    HOLD: '#fbbf24',
    SELL: '#f87171',
    STRONG_SELL: '#ef4444',
  }

  const signalEmoji = {
    STRONG_BUY: '\u{1F7E2}',
    BUY: '\u{1F7E2}',
    HOLD: '\u26AA',
    SELL: '\u{1F534}',
    STRONG_SELL: '\u{1F534}',
  }

  const currentSignal = signal?.signal || 'HOLD'
  const confidence = signal?.confidence || 0
  const currentPrice = price?.price || 0
  const change24h = price?.change_24h || 0

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 30,
        padding: '20px 0',
        borderBottom: '1px solid #222'
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>
          \u26A1 SOLANA QUANT PLATFORM
        </h1>
        <div style={{ 
          display: 'flex', 
          gap: 8, 
          alignItems: 'center',
          color: health?.status === 'healthy' ? '#4ade80' : '#f87171'
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />
          {health?.status || 'unknown'}
        </div>
      </header>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: 20, 
        marginBottom: 30 
      }}>
        <Card>
          <CardLabel>CURRENT SIGNAL</CardLabel>
          <div style={{ 
            fontSize: 28, 
            fontWeight: 800, 
            color: signalColor[currentSignal],
            margin: '10px 0'
          }}>
            {signalEmoji[currentSignal]} {currentSignal.replace('_', ' ')}
          </div>
          <div style={{ fontSize: 14, color: '#888' }}>
            ${currentPrice.toLocaleString()}
          </div>
        </Card>

        <Card>
          <CardLabel>CONFIDENCE</CardLabel>
          <div style={{ fontSize: 36, fontWeight: 800, margin: '10px 0' }}>
            {confidence}%
          </div>
          <div style={{ 
            height: 6, 
            background: '#222', 
            borderRadius: 3, 
            overflow: 'hidden' 
          }}>
            <div style={{ 
              width: `${confidence}%`, 
              height: '100%', 
              background: signalColor[currentSignal],
              transition: 'width 0.3s'
            }} />
          </div>
        </Card>

        <Card>
          <CardLabel>24H CHANGE</CardLabel>
          <div style={{ 
            fontSize: 36, 
            fontWeight: 800, 
            color: change24h >= 0 ? '#4ade80' : '#f87171',
            margin: '10px 0'
          }}>
            {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
          </div>
          <div style={{ fontSize: 14, color: '#888' }}>
            ${currentPrice.toLocaleString()}
          </div>
        </Card>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: 20, 
        marginBottom: 30 
      }}>
        <Card>
          <CardLabel>SCORING BREAKDOWN</CardLabel>
          <ScoreBar label="Technical" value={signal?.breakdown?.technical || 0} max={10} color="#818cf8" />
          <ScoreBar label="On-Chain" value={signal?.breakdown?.onchain || 0} max={10} color="#34d399" />
          <ScoreBar label="Sentiment" value={signal?.breakdown?.sentiment || 0} max={10} color="#fbbf24" />
          <ScoreBar label="Fundamental" value={signal?.breakdown?.fundamental || 0} max={10} color="#f87171" />
        </Card>

        <Card>
          <CardLabel>RISK MANAGEMENT</CardLabel>
          {signal?.risk_levels?.entry ? (
            <div>
              <InfoRow label="Entry" value={`$${signal.risk_levels.entry.toLocaleString()}`} />
              <InfoRow label="Stop Loss" value={`$${signal.risk_levels.stop_loss?.toLocaleString()}`} color="#f87171" />
              <InfoRow label="Take Profit" value={`$${signal.risk_levels.take_profit?.toLocaleString()}`} color="#4ade80" />
              <InfoRow label="RR Ratio" value={`${signal.risk_levels.rr_ratio}:1`} />
              <InfoRow label="Risk" value={`${signal.risk_levels.risk_pct}%`} />
            </div>
          ) : (
            <div style={{ color: '#666', padding: 20, textAlign: 'center' }}>
              No active signal
            </div>
          )}
        </Card>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 1fr', 
        gap: 20 
      }}>
        <Card>
          <CardLabel>TECHNICAL</CardLabel>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#818cf8' }}>
            {signal?.technical?.score?.toFixed(1) || '0.0'}/10
          </div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 10 }}>
            RSI: {signal?.technical?.rsi?.toFixed(1) || '-'}
          </div>
          <div style={{ fontSize: 13, color: '#888' }}>
            Vol Ratio: {signal?.technical?.volume_ratio?.toFixed(2) || '-'}x
          </div>
        </Card>

        <Card>
          <CardLabel>ON-CHAIN</CardLabel>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#34d399' }}>
            {signal?.onchain?.score?.toFixed(1) || '0.0'}/10
          </div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 10 }}>
            Net Flow: {signal?.onchain?.metrics?.net_exchange_flow?.toLocaleString() || '0'} SOL
          </div>
        </Card>

        <Card>
          <CardLabel>SENTIMENT</CardLabel>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#fbbf24' }}>
            {signal?.sentiment?.score?.toFixed(1) || '0.0'}/10
          </div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 10 }}>
            {signal?.sentiment?.classification || 'N/A'}
          </div>
          <div style={{ fontSize: 13, color: '#888' }}>
            Fear/Greed: {signal?.fear_greed || 50}
          </div>
        </Card>
      </div>

      <footer style={{ 
        marginTop: 40, 
        padding: '20px 0', 
        borderTop: '1px solid #222',
        textAlign: 'center',
        color: '#555',
        fontSize: 12
      }}>
        Solana Quant Platform v1.0.0 | Last update: {new Date().toLocaleTimeString()}
      </footer>
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{
      background: '#111118',
      border: '1px solid #222',
      borderRadius: 12,
      padding: 20,
    }}>
      {children}
    </div>
  )
}

function CardLabel({ children }) {
  return (
    <div style={{ 
      fontSize: 11, 
      fontWeight: 600, 
      color: '#666', 
      letterSpacing: 1,
      textTransform: 'uppercase'
    }}>
      {children}
    </div>
  )
}

function ScoreBar({ label, value, max, color }) {
  const pct = Math.max(0, Math.min(100, ((value + max) / (max * 2)) * 100))
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color }}>{value > 0 ? '+' : ''}{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 4, background: '#222', borderRadius: 2 }}>
        <div style={{ 
          width: `${pct}%`, 
          height: '100%', 
          background: color, 
          borderRadius: 2 
        }} />
      </div>
    </div>
  )
}

function InfoRow({ label, value, color }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      padding: '6px 0',
      fontSize: 13,
      borderBottom: '1px solid #1a1a24'
    }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color: color || '#e0e0e0', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: 20
    }}>
      <div style={{ fontSize: 24, fontWeight: 700 }}>Loading...</div>
      <div style={{ color: '#666' }}>Fetching market data</div>
    </div>
  )
}

function ErrorScreen({ error }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: 20
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#f87171' }}>Error</div>
      <div style={{ color: '#666' }}>{error}</div>
    </div>
  )
}
