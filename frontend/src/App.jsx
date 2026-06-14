import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0a0a0f', 
      color: '#e0e0e0',
      fontFamily: "'Inter', -apple-system, sans-serif"
    }}>
      <Dashboard />
    </div>
  )
}
