import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [mode, setMode] = useState(null); // 'friends' or 'ai'
  const [numPlayers, setNumPlayers] = useState(null);
  const [error, setError] = useState('');

  function handleModeSelect(selectedMode) {
    setMode(selectedMode);
    setNumPlayers(null);
  }

  function handleStart() {
    if (!playerName.trim()) { setError('Please enter your name'); return; }
    if (!numPlayers) { setError('Please select number of players'); return; }
    setError('');
    localStorage.setItem('playerName', playerName.trim());
    localStorage.setItem('numPlayers', numPlayers);
    localStorage.setItem('gameMode', mode);
    if (mode === 'friends') {
      navigate('/lobby');
    } else {
      navigate('/game');
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        {/* Logo */}
        <div style={styles.logoArea}>
          <div style={styles.logo}>🃏</div>
          <h1 style={styles.title}>Rummy</h1>
          <p style={styles.subtitle}>13 Card Indian Rummy</p>
        </div>

        {/* Name input */}
        <div style={styles.section}>
          <label style={styles.label}>Your Name</label>
          <input
            style={styles.input}
            placeholder="Enter your name..."
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            maxLength={20}
          />
        </div>

        {/* Mode selection */}
        <div style={styles.section}>
          <label style={styles.label}>Game Mode</label>
          <div style={styles.modeRow}>
            <button
              style={{ ...styles.modeBtn, ...(mode === 'friends' ? styles.modeBtnActive : {}) }}
              onClick={() => handleModeSelect('friends')}
            >
              <span style={styles.modeIcon}>👥</span>
              <span style={styles.modeName}>Play with Friends</span>
              <span style={styles.modeDesc}>Real multiplayer</span>
            </button>
            <button
              style={{ ...styles.modeBtn, ...(mode === 'ai' ? styles.modeBtnActive : {}) }}
              onClick={() => handleModeSelect('ai')}
            >
              <span style={styles.modeIcon}>🤖</span>
              <span style={styles.modeName}>Play with AI</span>
              <span style={styles.modeDesc}>vs Computer</span>
            </button>
          </div>
        </div>

        {/* Number of players */}
        {mode && (
          <div style={styles.section}>
            <label style={styles.label}>Number of Players</label>
            <div style={styles.playersRow}>
              {[2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  style={{ ...styles.numBtn, ...(numPlayers === n ? styles.numBtnActive : {}) }}
                  onClick={() => setNumPlayers(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && <p style={styles.error}>{error}</p>}

        {/* Start button */}
        <button style={styles.startBtn} onClick={handleStart}>
          {mode === 'friends' ? 'Go to Lobby →' : 'Start Game →'}
        </button>

      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0a1628 100%)',
    padding: '20px',
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '24px',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '420px',
    backdropFilter: 'blur(10px)',
  },
  logoArea: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logo: {
    fontSize: '64px',
    marginBottom: '8px',
  },
  title: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#FFD700',
    letterSpacing: '2px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '4px',
  },
  section: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '10px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
  },
  modeRow: {
    display: 'flex',
    gap: '12px',
  },
  modeBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '14px',
    color: '#fff',
    gap: '4px',
    transition: 'all 0.2s',
  },
  modeBtnActive: {
    background: 'rgba(255,215,0,0.15)',
    border: '1px solid #FFD700',
  },
  modeIcon: { fontSize: '28px' },
  modeName: { fontSize: '14px', fontWeight: '600' },
  modeDesc: { fontSize: '11px', color: 'rgba(255,255,255,0.5)' },
  playersRow: {
    display: 'flex',
    gap: '10px',
  },
  numBtn: {
    flex: 1,
    padding: '14px 0',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
  numBtnActive: {
    background: 'rgba(255,215,0,0.2)',
    border: '1px solid #FFD700',
    color: '#FFD700',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '13px',
    marginBottom: '16px',
    textAlign: 'center',
  },
  startBtn: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
    border: 'none',
    borderRadius: '14px',
    color: '#0a1628',
    fontSize: '16px',
    fontWeight: '700',
    letterSpacing: '0.5px',
    transition: 'opacity 0.2s',
  },
};