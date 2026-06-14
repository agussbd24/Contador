export async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<boolean> {
  if (!token || !chatId) return false;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return resp.ok;
  } catch (e) {
    console.error('Telegram error:', e);
    return false;
  }
}

export function formatSignalAlert(data: any): string {
  const emoji: Record<string, string> = {
    STRONG_BUY: '\u{1F7E2}', BUY: '\u{1F7E2}',
    HOLD: '\u26AA', SELL: '\u{1F534}', STRONG_SELL: '\u{1F534}',
  };

  const lines = [
    `${emoji[data.signal] || '\u26AA'} <b>${data.signal.replace('_', ' ')} - SOL/USDT</b>`,
    '\u2501'.repeat(28),
    '',
    `\u{1F4CA} Confidence: <b>${data.confidence}%</b>`,
    `\u{1F4B0} Price: <b>$${data.price?.toLocaleString()}</b>`,
    '',
    `\u{1F4C8} Technical: <b>${data.breakdown?.technical > 0 ? '+' : ''}${data.breakdown?.technical?.toFixed(1)}/10</b>`,
    `\u{1F517} On-Chain: <b>${data.breakdown?.onchain > 0 ? '+' : ''}${data.breakdown?.onchain?.toFixed(1)}/10</b>`,
    `\u{1F4AD} Sentiment: <b>${data.breakdown?.sentiment > 0 ? '+' : ''}${data.breakdown?.sentiment?.toFixed(1)}/10</b>`,
  ];

  if (data.risk_levels?.entry) {
    lines.push(
      '',
      '\u26A1 Risk Management',
      `   Entry: <b>$${data.risk_levels.entry.toLocaleString()}</b>`,
      `   Stop Loss: <b>$${data.risk_levels.stop_loss?.toLocaleString()}</b>`,
      `   Take Profit: <b>$${data.risk_levels.take_profit?.toLocaleString()}</b>`,
      `   RR: <b>${data.risk_levels.rr_ratio}:1</b>`,
    );
  }

  return lines.join('\n');
}

export function formatDailySummary(signals: any[], price: any): string {
  return [
    '\u{1F4CB} <b>DAILY SUMMARY - SOL/USDT</b>',
    '\u2501'.repeat(28),
    '',
    `\u{1F4B0} Price: <b>$${price?.price?.toLocaleString()}</b> (${price?.change_24h > 0 ? '+' : ''}${price?.change_24h}%)`,
    `\u{1F4C8} Signals today: ${signals.length}`,
    '',
    ...signals.slice(0, 5).map((s: any) => {
      const e = s.signal?.includes('BUY') ? '\u{1F7E2}' : s.signal?.includes('SELL') ? '\u{1F534}' : '\u26AA';
      return `   ${e} ${s.time?.split('T')[1]?.slice(0, 5) || ''} - ${s.signal} @ $${s.price?.toLocaleString()}`;
    }),
  ].join('\n');
}
