import React from 'react';

export default function Scoreboard({ players, scores, eliminated, currentTurn, round }) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Scoreboard</span>
        <span style={styles.round}>Round {round}</span>
      </div>

      <div style={styles.list}>
        {players.map((name, i) => (
          <div
            key={i}
            style={{
              ...styles.row,
              ...(currentTurn === i ? styles.rowActive : {}),
              ...(eliminated[i] ? styles.rowEliminated : {}),
            }}
          >
            {/* Avatar */}
            <div style={{
              ...styles.avatar,
              background: eliminated[i]
                ? 'rgba(255,255,255,0.1)'
                : currentTurn === i
                ? 'linear-gradient(135deg, #FFD700, #FFA500)'
                : 'rgba(255,255,255,0.15)',
              color: currentTurn === i ? '#0a1628' : '#fff',
            }}>
              {name.charAt(0).toUpperCase()}
            </div>

            {/* Name */}
            <div style={styles.nameArea}>
              <span style={styles.name}>{name}</span>
              {currentTurn === i && !eliminated[i] && (
                <span style={styles.turnBadge}>▶ Turn</span>
              )}
              {eliminated[i] && (
                <span style={styles.elimBadge}>Eliminated</span>
              )}
            </div>

            {/* Score */}
            <div style={{
              ...styles.score,
              color: scores[i] >= 200
                ? '#ff6b6b'
                : scores[i] >= 150
                ? '#FFA500'
                : '#fff',
            }}>
              {scores[i]}
              {scores[i] >= 200 && !eliminated[i] && (
                <span style={styles.dangerIcon}>⚠️</span>
              )}
            </div>

          </div>
        ))}
      </div>

      {/* 240 limit warning */}
      <div style={styles.footer}>
        <span style={styles.footerText}>Eliminated at 240 pts</span>
        <div style={styles.limitBar}>
          <div style={styles.limitFill} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    padding: '16px',
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  title: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  round: {
    fontSize: '12px',
    color: '#FFD700',
    fontWeight: '600',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid transparent',
    transition: 'all 0.2s',
  },
  rowActive: {
    background: 'rgba(255,215,0,0.08)',
    border: '1px solid rgba(255,215,0,0.3)',
  },
  rowEliminated: {
    opacity: 0.4,
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '700',
    flexShrink: 0,
  },
  nameArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  name: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#fff',
  },
  turnBadge: {
    fontSize: '10px',
    color: '#FFD700',
    fontWeight: '600',
  },
  elimBadge: {
    fontSize: '10px',
    color: '#ff6b6b',
    fontWeight: '600',
  },
  score: {
    fontSize: '18px',
    fontWeight: '700',
    minWidth: '40px',
    textAlign: 'right',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  dangerIcon: {
    fontSize: '12px',
  },
  footer: {
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  footerText: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.3)',
    display: 'block',
    marginBottom: '6px',
  },
  limitBar: {
    height: '3px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  limitFill: {
    height: '100%',
    width: '100%',
    background: 'linear-gradient(90deg, #00e676, #FFA500, #ff6b6b)',
    borderRadius: '2px',
  },
};