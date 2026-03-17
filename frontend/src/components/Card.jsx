import React from 'react';

// Card images from deckofcardsapi.com
function getCardImageUrl(card) {
  if (!card) return null;
  if (card.isJoker) return null;

  // Convert our rank/suit to API format
  const rankMap = {
    'A': 'A', '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6', '7': '7', '8': '8', '9': '9', '10': '0',
    'J': 'J', 'Q': 'Q', 'K': 'K'
  };
  const suitMap = { 'S': 'S', 'H': 'H', 'D': 'D', 'C': 'C' };

  const r = rankMap[card.rank];
  const s = suitMap[card.suit];
  if (!r || !s) return null;

  return `https://deckofcardsapi.com/static/img/${r}${s}.png`;
}

export default function Card({
  card,
  hidden = false,
  selected = false,
  onClick,
  small = false,
  isJokerCard = false,
}) {
  const width = small ? 48 : 72;
  const height = small ? 67 : 100;

  const containerStyle = {
    width: `${width}px`,
    height: `${height}px`,
    borderRadius: '6px',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'transform 0.15s, box-shadow 0.15s',
    transform: selected ? 'translateY(-14px)' : 'translateY(0)',
    boxShadow: selected
      ? '0 8px 24px rgba(255,215,0,0.5)'
      : isJokerCard
      ? '0 4px 12px rgba(255,165,0,0.4)'
      : '0 2px 8px rgba(0,0,0,0.4)',
    position: 'relative',
    flexShrink: 0,
  };

  // Hidden card (face down)
  if (hidden) {
    return (
      <div style={containerStyle} onClick={onClick}>
        <img
          src="https://deckofcardsapi.com/static/img/back.png"
          alt="card back"
          style={{ width: '100%', height: '100%', borderRadius: '6px', display: 'block' }}
        />
      </div>
    );
  }

  // Printed joker
  if (card?.isJoker) {
    return (
      <div
        style={{
          ...containerStyle,
          background: 'linear-gradient(135deg, #ff6b35, #f7c59f)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid #FFD700',
        }}
        onClick={onClick}
      >
        <span style={{ fontSize: small ? '20px' : '30px' }}>🃏</span>
        <span style={{ fontSize: small ? '8px' : '11px', fontWeight: '700', color: '#0a1628' }}>JOKER</span>
      </div>
    );
  }

  // Cut joker indicator badge
  const imageUrl = getCardImageUrl(card);

  return (
    <div style={containerStyle} onClick={onClick}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${card.rank}${card.suit}`}
          style={{ width: '100%', height: '100%', borderRadius: '6px', display: 'block' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%', borderRadius: '6px',
          background: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '12px', color: '#333'
        }}>
          {card?.rank}{card?.suit}
        </div>
      )}
      {/* Joker highlight border */}
      {isJokerCard && (
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '6px',
          border: '2px solid #FFD700',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}