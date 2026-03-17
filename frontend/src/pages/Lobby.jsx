import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

let socket;

export default function Lobby() {
  const navigate = useNavigate();
  const playerName = localStorage.getItem('playerName');
  const numPlayers = parseInt(localStorage.getItem('numPlayers'));
  const gameMode = localStorage.getItem('gameMode');

  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [players, setPlayers] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [step, setStep] = useState('choose'); // 'choose' | 'waiting'
  const [error, setError] = useState('');

  useEffect(() => {
    socket = io('http://localhost:4000');

    socket.on('room_created', ({ roomCode }) => {
      setRoomCode(roomCode);
      setStep('waiting');
      localStorage.setItem('roomCode', roomCode);
    });

    socket.on('room_joined', ({ roomCode }) => {
      setRoomCode(roomCode);
      setStep('waiting');
      localStorage.setItem('roomCode', roomCode);
    });

    socket.on('lobby_update', ({ players }) => {
      setPlayers(players);
    });

    socket.on('game_started', () => {
      localStorage.setItem('socketId', socket.id);
      navigate('/game');
    });

    socket.on('error', (msg) => setError(msg));

    return () => socket.disconnect();
  }, [navigate]);

  function createRoom() {
    if (!playerName) return;
    socket.emit('create_room', { playerName, numPlayers });
  }

  function joinRoom() {
    if (!joinCode.trim()) { setError('Enter a room code'); return; }
    socket.emit('join_room', { playerName, roomCode: joinCode.trim().toUpperCase() });
  }

  function handleReady() {
    socket.emit('player_ready', { roomCode });
    setIsReady(true);
  }

  // AI mode — go straight to game
  useEffect(() => {
    if (gameMode === 'ai') navigate('/game');
  }, [gameMode, navigate]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>

        <div style={styles.header}>
          <span style={styles.backBtn} onClick={() => navigate('/')}>← Back</span>
          <h2 style={styles.title}>Game Lobby</h2>
          <span />
        </div>

        {step === 'choose' && (
          <>
            <div style={styles.section}>
              <p style={styles.label}>Create a new room</p>
              <button style={styles.primaryBtn} onClick={createRoom}>
                🎮 Create Room
              </button>
            </div>

            <div style={styles.divider}><span>or</span></div>

            <div style={styles.section}>
              <p style={styles.label}>Join existing room</p>
              <input
                style={styles.input}
                placeholder="Enter room code..."
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={5}
              />
              <button style={{ ...styles.primaryBtn, marginTop: '10px' }} onClick={joinRoom}>
                🚪 Join Room
              </button>
            </div>

            {error && <p style={styles.error}>{error}</p>}
          </>
        )}

        {step === 'waiting' && (
          <>
            {/* Room code display */}
            <div style={styles.roomCodeBox}>
              <p style={styles.roomCodeLabel}>Share this code with friends</p>
              <p style={styles.roomCode}>{roomCode}</p>
              <button
                style={styles.copyBtn}
                onClick={() => navigator.clipboard.writeText(roomCode)}
              >
                📋 Copy Code
              </button>
            </div>

            {/* Players list */}
            <div style={styles.section}>
              <p style={styles.label}>
                Players ({players.length}/{numPlayers})
              </p>
              <div style={styles.playersList}>
                {players.map((p, i) => (
                  <div key={i} style={styles.playerRow}>
                    <div style={styles.playerAvatar}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span style={styles.playerName}>{p.name}</span>
                    <span style={p.ready ? styles.badgeReady : styles.badgeWaiting}>
                      {p.ready ? '✓ Ready' : 'Waiting...'}
                    </span>
                  </div>
                ))}
                {/* Empty slots */}
                {Array(numPlayers - players.length).fill(0).map((_, i) => (
                  <div key={`empty-${i}`} style={{ ...styles.playerRow, opacity: 0.3 }}>
                    <div style={{ ...styles.playerAvatar, background: 'rgba(255,255,255,0.1)' }}>?</div>
                    <span style={styles.playerName}>Waiting for player...</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ready button */}
            <button
              style={{ ...styles.primaryBtn, ...(isReady ? styles.readyActive : {}) }}
              onClick={handleReady}
              disabled={isReady}
            >
              {isReady ? '✓ You are Ready!' : '✋ Press Ready'}
            </button>

            <p style={styles.hint}>
              Game starts when all {numPlayers} players press Ready
            </p>
          </>
        )}

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
    padding: '32px',
    width: '100%',
    maxWidth: '440px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '28px',
  },
  backBtn: {
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    fontSize: '14px',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#FFD700',
  },
  section: {
    marginBottom: '20px',
  },
  label: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
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
    fontSize: '18px',
    fontWeight: '700',
    letterSpacing: '4px',
    outline: 'none',
    textAlign: 'center',
  },
  primaryBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
    border: 'none',
    borderRadius: '12px',
    color: '#0a1628',
    fontSize: '15px',
    fontWeight: '700',
  },
  readyActive: {
    background: 'linear-gradient(135deg, #00c853, #00e676)',
  },
  divider: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    margin: '16px 0',
    fontSize: '13px',
  },
  roomCodeBox: {
    background: 'rgba(255,215,0,0.08)',
    border: '1px solid rgba(255,215,0,0.3)',
    borderRadius: '16px',
    padding: '20px',
    textAlign: 'center',
    marginBottom: '24px',
  },
  roomCodeLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  roomCode: {
    fontSize: '40px',
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: '8px',
    marginBottom: '12px',
  },
  copyBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,215,0,0.4)',
    borderRadius: '8px',
    color: '#FFD700',
    padding: '6px 16px',
    fontSize: '13px',
  },
  playersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '12px',
    padding: '10px 14px',
  },
  playerAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    color: '#0a1628',
    fontSize: '16px',
  },
  playerName: {
    flex: 1,
    fontSize: '15px',
    fontWeight: '500',
  },
  badgeReady: {
    background: 'rgba(0,200,83,0.2)',
    color: '#00e676',
    borderRadius: '20px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '600',
  },
  badgeWaiting: {
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.4)',
    borderRadius: '20px',
    padding: '4px 10px',
    fontSize: '12px',
  },
  hint: {
    textAlign: 'center',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.3)',
    marginTop: '12px',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '13px',
    textAlign: 'center',
    marginTop: '8px',
  },
};