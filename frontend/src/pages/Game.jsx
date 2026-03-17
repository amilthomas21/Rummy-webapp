import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Card from '../components/Card';
import Scoreboard from '../components/Scoreboard';

let socket;

export default function Game() {
  const navigate = useNavigate();
  const playerName = localStorage.getItem('playerName');
  const gameMode = localStorage.getItem('gameMode');
  const numPlayers = parseInt(localStorage.getItem('numPlayers'));

  const [gs, setGs] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [message, setMessage] = useState('');
  const [roundResult, setRoundResult] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [debugLog, setDebugLog] = useState('Connecting...');
  const [timeLeft, setTimeLeft] = useState(30);
  const [groups, setGroups] = useState([[], [], [], []]);
  const [localHand, setLocalHand] = useState([]);

  useEffect(() => {
    socket = io('http://localhost:4000');

    socket.on('connect', () => {
      setDebugLog('Connected! Setting up game...');
      if (gameMode === 'ai') {
        socket.emit('create_room', { playerName, numPlayers, isAI: true });
      } else {
        const roomCode = localStorage.getItem('roomCode');
        socket.emit('join_room', { playerName, roomCode });
      }
    });

    socket.on('room_created', ({ roomCode: rc }) => {
      setDebugLog('Room created: ' + rc);
      localStorage.setItem('roomCode', rc);
      socket.emit('player_ready', { roomCode: rc });
    });

    socket.on('room_joined', ({ roomCode: rc }) => {
      setDebugLog('Room joined: ' + rc);
    });

    socket.on('game_started', () => {
      setDebugLog('Game started!');
    });

    socket.on('game_state', (state) => {
      setDebugLog('Playing!');
      setGs(state);
      setLocalHand(state.myHand);
      setGroups(state.myGroups && state.myGroups.length > 0 ? state.myGroups : [[], [], [], []]);
      setTimeLeft(state.turnTimeLeft || 30);
      setMessage('');
    });

    socket.on('timer_update', ({ timeLeft: t }) => {
      setTimeLeft(t);
    });

    socket.on('round_ended', (result) => {
      setRoundResult(result);
      if (result.gameOver) setGameOver(result);
    });

    socket.on('invalid_declare', (msg) => {
      setMessage(msg);
      setTimeout(() => setMessage(''), 4000);
    });

    socket.on('error', (msg) => {
      setDebugLog('Error: ' + msg);
      setMessage(msg);
    });

    socket.on('connect_error', (err) => {
      setDebugLog('Connection failed: ' + err.message);
    });

    return () => socket.disconnect();
  }, []);

  function getRoomCode() {
    return localStorage.getItem('roomCode');
  }

  function drawCard(from) {
    if (!gs || gs.currentTurn !== gs.myIndex || gs.drawn) return;
    if (!socket || !socket.connected) { setMessage('Reconnecting...'); return; }
    socket.emit('draw_card', { roomCode: getRoomCode(), from });
  }

  function discardCard() {
    if (!selectedCard || !gs?.drawn || gs.currentTurn !== gs.myIndex) return;
    const newHand = localHand.filter(c => c.id !== selectedCard.id);
    setLocalHand(newHand);
    socket.emit('discard_card', { roomCode: getRoomCode(), cardId: selectedCard.id });
    setSelectedCard(null);
  }

  function selectCard(card) {
    if (gs?.currentTurn !== gs?.myIndex) return;
    setSelectedCard(prev => prev?.id === card.id ? null : card);
  }

  function addCardToGroup(groupIdx) {
    if (!selectedCard) {
      setMessage('Select a card from your hand first!');
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    if (!gs?.drawn) {
      setMessage('Draw a card first!');
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    const newGroups = groups.map(g => [...g]);
    let newHand = [...localHand];
    let fromGroup = -1;
    newGroups.forEach((g, i) => {
      if (g.find(c => c.id === selectedCard.id)) fromGroup = i;
    });
    if (fromGroup !== -1) {
      newGroups[fromGroup] = newGroups[fromGroup].filter(c => c.id !== selectedCard.id);
    } else {
      newHand = newHand.filter(c => c.id !== selectedCard.id);
    }
    newGroups[groupIdx] = [...newGroups[groupIdx], selectedCard];
    setGroups(newGroups);
    setLocalHand(newHand);
    setSelectedCard(null);
    socket.emit('update_groups', { roomCode: getRoomCode(), groups: newGroups, hand: newHand });
  }

  function removeFromGroup(card, groupIdx) {
    const newGroups = groups.map(g => [...g]);
    newGroups[groupIdx] = newGroups[groupIdx].filter(c => c.id !== card.id);
    const newHand = [...localHand, card];
    setGroups(newGroups);
    setLocalHand(newHand);
    socket.emit('update_groups', { roomCode: getRoomCode(), groups: newGroups, hand: newHand });
  }

  function addNewGroup() {
    if (groups.length >= 6) return;
    setGroups([...groups, []]);
  }

  function removeGroup(idx) {
    if (groups.length <= 2) return;
    const newGroups = groups.map(g => [...g]);
    const returnCards = newGroups.splice(idx, 1)[0];
    const newHand = [...localHand, ...returnCards];
    setGroups(newGroups);
    setLocalHand(newHand);
    socket.emit('update_groups', { roomCode: getRoomCode(), groups: newGroups, hand: newHand });
  }

  function sortHand() {
    const RANK_ORDER = { A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13,JK:14 };
    const SUIT_ORDER = { S:0, H:1, D:2, C:3, '*':4 };
    const sorted = [...localHand].sort((a, b) => {
      if (a.suit !== b.suit) return (SUIT_ORDER[a.suit]||0) - (SUIT_ORDER[b.suit]||0);
      return (RANK_ORDER[a.rank]||0) - (RANK_ORDER[b.rank]||0);
    });
    setLocalHand(sorted);
  }

  function declareWin() {
    socket.emit('declare_win', { roomCode: getRoomCode() });
  }

  function nextRound() {
    setRoundResult(null);
    setGroups([[], [], [], []]);
    setLocalHand([]);
    socket.emit('player_ready', { roomCode: getRoomCode() });
  }

  function isJokerCard(card) {
    if (!card || !gs) return false;
    return card.isJoker || (gs.cutCardVisible && card.rank === gs.cutRank);
  }

  function validatePureLocal(cards) {
    if (!cards || cards.length < 3) return false;
    if (cards.some(c => c.isJoker)) return false;
    const RV = { A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13 };
    const suits = [...new Set(cards.map(c => c.suit))];
    if (suits.length > 1) return false;
    const vals = cards.map(c => RV[c.rank]).sort((a,b) => a-b);
    for (let i=1; i<vals.length; i++) if (vals[i]-vals[i-1] !== 1) return false;
    return true;
  }

  function validateSeqLocal(cards) {
    if (!cards || cards.length < 3) return false;
    const RV = { A:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13 };

    const nonJokers = cards.filter(c => !isJokerCard(c));
    const jokerCount = cards.filter(c => isJokerCard(c)).length;

    if (nonJokers.length === 0) return false;

    // Check set: same rank, all different suits
    const ranks = [...new Set(nonJokers.map(c => c.rank))];
    const suits = nonJokers.map(c => c.suit);
    const uniqueSuits = new Set(suits);
    if (ranks.length === 1 && uniqueSuits.size === suits.length) {
      const total = nonJokers.length + jokerCount;
      if (total >= 3 && total <= 4) return true;
    }

    // Check sequence: same suit, consecutive
    const seqSuits = [...new Set(nonJokers.map(c => c.suit))];
    if (seqSuits.length > 1) return false;
    const vals = nonJokers.map(c => RV[c.rank]).sort((a,b) => a-b);
    for (let i=1; i<vals.length; i++) if (vals[i] === vals[i-1]) return false;
    let gaps = 0;
    for (let i=1; i<vals.length; i++) gaps += vals[i]-vals[i-1]-1;
    if (gaps <= jokerCount) return true;

    // Wrap-around J-Q-K-A
    if (vals.includes(1) && vals.includes(13)) {
      const adj = vals.map(v => v===1?14:v).sort((a,b)=>a-b);
      let wgaps = 0;
      for (let i=1; i<adj.length; i++) wgaps += adj[i]-adj[i-1]-1;
      if (wgaps <= jokerCount) return true;
    }

    return false;
  }

  function groupStatus(g, isFirst) {
    if (!g || g.length === 0) return 'empty';
    if (g.length < 3) return 'building';
    if (isFirst) return validatePureLocal(g) ? 'valid' : 'invalid';
    return validateSeqLocal(g) ? 'valid' : 'invalid';
  }

  const myTurn = gs?.currentTurn === gs?.myIndex;
  const totalGroupCards = groups.reduce((s,g) => s+g.length, 0);
  const timerColor = timeLeft<=10 ? '#ff4444' : timeLeft<=20 ? '#FFA500' : '#00e676';

  if (!gs) return (
    <div style={styles.loading}>
      <div style={styles.loadingCard}>
        <div style={{fontSize:'64px',marginBottom:'16px'}}>🃏</div>
        <p style={{color:'#FFD700',fontSize:'20px',fontWeight:'700'}}>{debugLog}</p>
        <p style={{color:'rgba(255,255,255,0.3)',fontSize:'13px',marginTop:'8px'}}>
          {gameMode==='ai' ? 'Setting up AI game...' : 'Waiting for players...'}
        </p>
        <button style={styles.backBtn} onClick={() => navigate('/')}>← Back to Menu</button>
      </div>
    </div>
  );

  return (
    <div style={styles.container}>

      {roundResult && !gameOver && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <div style={{fontSize:'48px',marginBottom:'8px'}}>🏆</div>
            <h2 style={styles.overlayTitle}>{roundResult.winnerName} wins round {gs.round}!</h2>
            <div style={styles.resultTable}>
              {roundResult.players.map((name,i) => (
                <div key={i} style={styles.resultRow}>
                  <span>{name}</span>
                  <span style={{color:'#FFD700'}}>+{roundResult.roundScores[i]}</span>
                  <span style={{fontWeight:'700'}}>{roundResult.totalScores[i]} pts</span>
                  {roundResult.eliminated[i] && <span style={{color:'#ff6b6b',fontSize:'12px'}}>Eliminated</span>}
                </div>
              ))}
            </div>
            <button style={styles.overlayBtn} onClick={nextRound}>Next Round →</button>
          </div>
        </div>
      )}

      {gameOver && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <div style={{fontSize:'64px',marginBottom:'8px'}}>🏆</div>
            <h2 style={styles.overlayTitle}>{gameOver.players[gameOver.winnerIdx]} wins the game!</h2>
            <div style={styles.resultTable}>
              {gameOver.players.map((name,i) => (
                <div key={i} style={styles.resultRow}>
                  <span>{name}</span>
                  <span style={{fontWeight:'700'}}>{gameOver.totalScores[i]} pts</span>
                  {i===gameOver.winnerIdx && <span style={{color:'#FFD700'}}>Champion 🏆</span>}
                </div>
              ))}
            </div>
            <button style={styles.overlayBtn} onClick={() => navigate('/')}>Play Again</button>
          </div>
        </div>
      )}

      <div style={styles.layout}>

        <div style={styles.leftPanel}>
          <Scoreboard
            players={gs.players}
            scores={gs.scores}
            eliminated={gs.eliminated}
            currentTurn={gs.currentTurn}
            round={gs.round}
          />
          <div style={{...styles.timerBox, borderColor:timerColor}}>
            <p style={styles.timerLabel}>Turn Timer</p>
            <div style={{...styles.timerCircle, borderColor:timerColor}}>
              <span style={{...styles.timerNum, color:timerColor}}>{timeLeft}</span>
            </div>
            <p style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',marginTop:'4px',textAlign:'center'}}>
              {myTurn ? '⚡ Your turn!' : gs.players[gs.currentTurn]+"'s turn"}
            </p>
          </div>
          <div style={styles.jokerInfo}>
            <p style={styles.jokerLabel}>Cut Joker</p>
            {gs.cutCardVisible ? (
              <div style={styles.jokerRevealed}>
                <span style={{fontSize:'28px'}}>🃏</span>
                <span style={{color:'#FFD700',fontWeight:'700',fontSize:'13px',textAlign:'center'}}>
                  All {gs.cutRank}s are wild!
                </span>
              </div>
            ) : (
              <div style={styles.jokerHidden}>
                <span style={{fontSize:'28px'}}>🔒</span>
                <span style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',textAlign:'center'}}>
                  Complete Main Rummy to reveal
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={styles.centerPanel}>
          <div style={styles.statusBar}>
            {message ? <span style={{color:'#ff6b6b'}}>{message}</span>
            : myTurn ? <span style={{color:'#00e676'}}>
                {gs.drawn ? '✓ Card drawn — arrange sets then discard' : '← Draw a card to start your turn'}
              </span>
            : <span style={{color:'rgba(255,255,255,0.5)'}}>Waiting for {gs.players[gs.currentTurn]}...</span>}
          </div>

          <div style={styles.opponents}>
            {gs.players.map((name,i) => {
              if (i===gs.myIndex || gs.eliminated[i]) return null;
              return (
                <div key={i} style={{...styles.opponentArea,...(gs.currentTurn===i?styles.opponentActive:{})}}>
                  <span style={styles.opponentName}>
                    {name} ({gs.handCounts[i]} cards)
                    {gs.currentTurn===i && <span style={{color:'#FFD700'}}> ▶</span>}
                  </span>
                  <div style={styles.opponentCards}>
                    {Array(Math.min(gs.handCounts[i],13)).fill(0).map((_,j) => <Card key={j} hidden small/>)}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={styles.pileRow}>
            <div style={styles.pile}>
              <p style={styles.pileLabel}>Draw Pile ({gs.deckCount})</p>
              <div style={myTurn&&!gs.drawn?{cursor:'pointer',filter:'brightness(1.4)'}:{opacity:0.6}} onClick={()=>drawCard('deck')}>
                <Card hidden/>
              </div>
            </div>
            <div style={styles.pile}>
              <p style={styles.pileLabel}>Discard Pile</p>
              <div style={myTurn&&!gs.drawn?{cursor:'pointer',filter:'brightness(1.4)'}:{opacity:0.6}} onClick={()=>drawCard('discard')}>
                {gs.discardTop
                  ? <Card card={gs.discardTop} isJokerCard={isJokerCard(gs.discardTop)}/>
                  : <div style={styles.emptyPile}>Empty</div>}
              </div>
            </div>
          </div>

          <div style={styles.groupsArea}>
            <div style={styles.groupsHeader}>
              <p style={styles.sectionLabel}>Your Sets — {totalGroupCards}/13 cards</p>
              <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
                <span style={{fontSize:'11px',color:'rgba(255,255,255,0.25)'}}>
                  Need: 1 pure sequence + other valid sets = 13 total
                </span>
                <button style={styles.addGroupBtn} onClick={addNewGroup}>+ Add Set</button>
              </div>
            </div>
            <div style={styles.groupsGrid}>
              {groups.map((g,gi) => {
                const status = groupStatus(g, gi===0);
                const isMain = gi===0;
                return (
                  <div key={gi}
                    style={{
                      ...styles.groupSlot,
                      ...(status==='valid'?styles.groupValid:{}),
                      ...(status==='invalid'?styles.groupInvalid:{}),
                      ...(status==='building'?styles.groupBuilding:{}),
                    }}
                    onClick={() => addCardToGroup(gi)}
                  >
                    <div style={styles.groupHeader}>
                      <span style={{...styles.groupLabel, color:isMain?'#FFD700':'rgba(255,255,255,0.5)'}}>
                        {isMain ? '⭐ Main Rummy' : `Set ${gi+1}`}
                      </span>
                      <div style={{display:'flex',gap:'5px',alignItems:'center'}}>
                        {g.length > 0 && (
                          <span style={{
                            fontSize:'10px',padding:'2px 7px',borderRadius:'10px',
                            background: status==='valid'?'rgba(0,200,83,0.2)':status==='building'?'rgba(255,215,0,0.15)':'rgba(255,68,68,0.2)',
                            color: status==='valid'?'#00e676':status==='building'?'#FFD700':'#ff6b6b',
                          }}>
                            {status==='valid'?'✓ Valid':status==='building'?`${g.length} cards`:'✗ Invalid'}
                          </span>
                        )}
                        {gi > 0 && (
                          <button style={styles.removeGroupBtn}
                            onClick={e => { e.stopPropagation(); removeGroup(gi); }}>×</button>
                        )}
                      </div>
                    </div>
                    <div style={styles.groupCards}>
                      {g.map((card,ci) => (
                        <Card key={card.id||ci} card={card} small
                          isJokerCard={isJokerCard(card)}
                          onClick={e => { e.stopPropagation(); removeFromGroup(card,gi); }}/>
                      ))}
                      {g.length===0 && (
                        <span style={styles.groupEmpty}>
                          {isMain ? 'Pure sequence only — no jokers' : 'Click to place selected card here'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={styles.actionRow}>
            <button style={styles.sortBtn} onClick={sortHand}>↕ Sort Hand</button>
            <button
              style={{
                ...styles.actionBtn,
                background: (!selectedCard||!gs.drawn||!myTurn) ? 'rgba(255,107,53,0.35)' : 'linear-gradient(135deg,#ff6b35,#ff4444)',
                color:'#fff',
                cursor: (!selectedCard||!gs.drawn||!myTurn) ? 'not-allowed' : 'pointer',
              }}
              onClick={discardCard}
              disabled={!selectedCard||!gs.drawn||!myTurn}
            >
              Discard Selected
            </button>
            <button
              style={{
                ...styles.actionBtn,
                background: (!myTurn||localHand.length!==0) ? 'rgba(255,215,0,0.25)' : 'linear-gradient(135deg,#FFD700,#FFA500)',
                color:'#0a1628',
                cursor: (!myTurn||localHand.length!==0) ? 'not-allowed' : 'pointer',
              }}
              onClick={declareWin}
              disabled={!myTurn||localHand.length!==0}
            >
              Declare Win 🏆
            </button>
          </div>

          <div style={styles.handArea}>
            <p style={styles.sectionLabel}>
              Your Hand ({localHand.length} cards)
              {myTurn && !gs.drawn && (
                <span style={{color:'#FFD700',marginLeft:'10px',fontSize:'12px'}}>← Draw first!</span>
              )}
              {selectedCard && (
                <span style={{color:'#60a5fa',marginLeft:'10px',fontSize:'12px'}}>
                  Selected: {selectedCard.rank}{selectedCard.isJoker?'':selectedCard.suit} — click a set to place it
                </span>
              )}
            </p>
            <div style={styles.hand}>
              {localHand.map((card,i) => (
                <Card key={card.id||i} card={card}
                  selected={selectedCard?.id===card.id}
                  isJokerCard={isJokerCard(card)}
                  onClick={() => selectCard(card)}/>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container:{minHeight:'100vh',background:'linear-gradient(135deg,#0a1628 0%,#0d2137 50%,#0a1628 100%)',padding:'12px'},
  loading:{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a1628'},
  loadingCard:{textAlign:'center',padding:'40px',display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'},
  backBtn:{marginTop:'16px',background:'transparent',border:'1px solid rgba(255,255,255,0.2)',borderRadius:'10px',color:'rgba(255,255,255,0.6)',padding:'10px 20px',fontSize:'14px',cursor:'pointer',fontFamily:'inherit'},
  layout:{display:'flex',gap:'12px',maxWidth:'1500px',margin:'0 auto',alignItems:'flex-start'},
  leftPanel:{width:'210px',flexShrink:0,display:'flex',flexDirection:'column',gap:'10px'},
  centerPanel:{flex:1,display:'flex',flexDirection:'column',gap:'10px'},
  timerBox:{background:'rgba(255,255,255,0.04)',border:'1px solid',borderRadius:'12px',padding:'12px',display:'flex',flexDirection:'column',alignItems:'center',gap:'6px'},
  timerLabel:{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'1px'},
  timerCircle:{width:'60px',height:'60px',borderRadius:'50%',border:'3px solid',display:'flex',alignItems:'center',justifyContent:'center'},
  timerNum:{fontSize:'24px',fontWeight:'700'},
  jokerInfo:{background:'rgba(255,215,0,0.06)',border:'1px solid rgba(255,215,0,0.2)',borderRadius:'12px',padding:'12px'},
  jokerLabel:{fontSize:'11px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'8px'},
  jokerRevealed:{display:'flex',flexDirection:'column',alignItems:'center',gap:'6px'},
  jokerHidden:{display:'flex',flexDirection:'column',alignItems:'center',gap:'6px'},
  statusBar:{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'10px 16px',fontSize:'13px',fontWeight:'500',textAlign:'center'},
  opponents:{display:'flex',gap:'8px',flexWrap:'wrap'},
  opponentArea:{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'12px',padding:'8px 12px',flex:1,minWidth:'140px'},
  opponentActive:{border:'1px solid rgba(255,215,0,0.4)',background:'rgba(255,215,0,0.05)'},
  opponentName:{fontSize:'12px',color:'rgba(255,255,255,0.6)',display:'block',marginBottom:'6px',fontWeight:'600'},
  opponentCards:{display:'flex',flexWrap:'wrap',gap:'2px'},
  pileRow:{display:'flex',gap:'32px',justifyContent:'center',alignItems:'flex-end',padding:'4px 0'},
  pile:{display:'flex',flexDirection:'column',alignItems:'center',gap:'6px'},
  pileLabel:{fontSize:'11px',color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.5px'},
  emptyPile:{width:'72px',height:'100px',borderRadius:'6px',border:'2px dashed rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.3)',fontSize:'12px'},
  groupsArea:{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'14px',padding:'12px'},
  groupsHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px',flexWrap:'wrap',gap:'8px'},
  sectionLabel:{fontSize:'12px',color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'1px'},
  addGroupBtn:{background:'rgba(55,138,221,0.2)',border:'1px solid rgba(55,138,221,0.4)',borderRadius:'8px',color:'#60a5fa',padding:'4px 12px',fontSize:'12px',cursor:'pointer',fontFamily:'inherit'},
  groupsGrid:{display:'flex',flexWrap:'wrap',gap:'8px'},
  groupSlot:{flex:'1 1 180px',background:'rgba(255,255,255,0.03)',border:'1.5px dashed rgba(255,255,255,0.1)',borderRadius:'10px',padding:'10px',cursor:'pointer',minHeight:'90px',transition:'border-color 0.2s,background 0.2s'},
  groupValid:{border:'1.5px solid rgba(0,200,83,0.5)',background:'rgba(0,200,83,0.04)'},
  groupInvalid:{border:'1.5px solid rgba(255,68,68,0.4)',background:'rgba(255,68,68,0.03)'},
  groupBuilding:{border:'1.5px solid rgba(255,215,0,0.3)',background:'rgba(255,215,0,0.03)'},
  groupHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'},
  groupLabel:{fontSize:'11px',fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.5px'},
  removeGroupBtn:{background:'rgba(255,68,68,0.2)',border:'none',borderRadius:'50%',color:'#ff6b6b',width:'20px',height:'20px',fontSize:'16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit',lineHeight:1,flexShrink:0},
  groupCards:{display:'flex',flexWrap:'wrap',gap:'4px',minHeight:'52px',alignItems:'center'},
  groupEmpty:{fontSize:'11px',color:'rgba(255,255,255,0.18)',fontStyle:'italic',lineHeight:1.4},
  actionRow:{display:'flex',gap:'8px'},
  sortBtn:{padding:'11px 16px',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.07)',color:'#fff',fontSize:'13px',fontWeight:'600',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'},
  actionBtn:{flex:1,padding:'11px',borderRadius:'10px',border:'none',fontSize:'13px',fontWeight:'600',fontFamily:'inherit'},
  handArea:{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'14px',padding:'12px'},
  hand:{display:'flex',flexWrap:'wrap',gap:'6px',minHeight:'110px',marginTop:'8px'},
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100},
  overlayCard:{background:'#0d2137',border:'1px solid rgba(255,215,0,0.3)',borderRadius:'24px',padding:'36px',textAlign:'center',maxWidth:'420px',width:'90%'},
  overlayTitle:{fontSize:'22px',fontWeight:'700',color:'#FFD700',marginBottom:'20px'},
  resultTable:{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'24px'},
  resultRow:{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(255,255,255,0.05)',borderRadius:'10px',padding:'10px 14px',fontSize:'14px',gap:'8px'},
  overlayBtn:{width:'100%',padding:'14px',background:'linear-gradient(135deg,#FFD700,#FFA500)',border:'none',borderRadius:'12px',color:'#0a1628',fontSize:'16px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'},
};