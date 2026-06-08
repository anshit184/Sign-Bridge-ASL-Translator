// ═══════════════════════════════════════════
//  ASL SIGNS DATA
//  Contains: emoji representations, descriptions,
//  and finger landmark rules for detection
// ═══════════════════════════════════════════

const ASL_SIGNS = {
  A: {
    emoji: '✊',
    description: 'Fist with thumb on side',
    hint: 'Closed fist, thumb rests against index finger',
    fingers: { thumb: 'side', index: 'bent', middle: 'bent', ring: 'bent', pinky: 'bent' }
  },
  B: {
    emoji: '🖐',
    description: 'Flat open hand, fingers together',
    hint: 'All four fingers straight up, thumb folded across palm',
    fingers: { thumb: 'folded', index: 'up', middle: 'up', ring: 'up', pinky: 'up' }
  },
  C: {
    emoji: '🤏',
    description: 'Curved hand like letter C',
    hint: 'Fingers and thumb curve to form a C shape',
    fingers: { thumb: 'curved', index: 'curved', middle: 'curved', ring: 'curved', pinky: 'curved' }
  },
  D: {
    emoji: '👆',
    description: 'Index finger up, others curved to thumb',
    hint: 'Index finger points up, other fingers touch thumb',
    fingers: { thumb: 'curled_tip', index: 'up', middle: 'bent', ring: 'bent', pinky: 'bent' }
  },
  E: {
    emoji: '🤜',
    description: 'Fingers bent, thumb tucked under',
    hint: 'All fingers curl toward palm, thumb tucked underneath',
    fingers: { thumb: 'tucked', index: 'bent', middle: 'bent', ring: 'bent', pinky: 'bent' }
  },
  F: {
    emoji: '👌',
    description: 'OK sign — index and thumb touch',
    hint: 'Index and thumb form a circle, other fingers spread',
    fingers: { thumb: 'circle', index: 'circle', middle: 'up', ring: 'up', pinky: 'up' }
  },
  G: {
    emoji: '👉',
    description: 'Index finger and thumb point sideways',
    hint: 'Index finger points sideways, thumb also extended',
    fingers: { thumb: 'out', index: 'out', middle: 'bent', ring: 'bent', pinky: 'bent' }
  },
  H: {
    emoji: '✌️',
    description: 'Index and middle fingers extended horizontally',
    hint: 'Index and middle fingers point sideways together',
    fingers: { thumb: 'bent', index: 'out', middle: 'out', ring: 'bent', pinky: 'bent' }
  },
  I: {
    emoji: '🤙',
    description: 'Pinky finger extended up',
    hint: 'Only pinky finger points up',
    fingers: { thumb: 'bent', index: 'bent', middle: 'bent', ring: 'bent', pinky: 'up' }
  },
  J: {
    emoji: '🤙',
    description: 'Pinky up, draw a J in air',
    hint: 'Like I, but trace a J shape in the air',
    fingers: { thumb: 'bent', index: 'bent', middle: 'bent', ring: 'bent', pinky: 'up' },
    motion: true
  },
  K: {
    emoji: '✌️',
    description: 'Index up, middle angled, thumb between',
    hint: 'Index finger up, middle finger angled, thumb between them',
    fingers: { thumb: 'between', index: 'up', middle: 'diagonal', ring: 'bent', pinky: 'bent' }
  },
  L: {
    emoji: '👈',
    description: 'L shape: index up, thumb out',
    hint: 'Index finger points up, thumb points sideways (L shape)',
    fingers: { thumb: 'out', index: 'up', middle: 'bent', ring: 'bent', pinky: 'bent' }
  },
  M: {
    emoji: '✊',
    description: 'Three fingers over thumb',
    hint: 'Index, middle, ring fingers tucked over thumb',
    fingers: { thumb: 'tucked', index: 'over_thumb', middle: 'over_thumb', ring: 'over_thumb', pinky: 'bent' }
  },
  N: {
    emoji: '✊',
    description: 'Two fingers over thumb',
    hint: 'Index, middle fingers tucked over thumb',
    fingers: { thumb: 'tucked', index: 'over_thumb', middle: 'over_thumb', ring: 'bent', pinky: 'bent' }
  },
  O: {
    emoji: '👌',
    description: 'All fingers curved to thumb — O shape',
    hint: 'All fingers curve to meet thumb, making an O',
    fingers: { thumb: 'circle_all', index: 'circle_all', middle: 'circle_all', ring: 'circle_all', pinky: 'circle_all' }
  },
  P: {
    emoji: '👇',
    description: 'Like K but pointing down',
    hint: 'K handshape rotated to point downward',
    fingers: { thumb: 'between', index: 'down', middle: 'diagonal', ring: 'bent', pinky: 'bent' }
  },
  Q: {
    emoji: '👇',
    description: 'Index and thumb point down',
    hint: 'Like G but pointing downward',
    fingers: { thumb: 'down', index: 'down', middle: 'bent', ring: 'bent', pinky: 'bent' }
  },
  R: {
    emoji: '🤞',
    description: 'Index and middle fingers crossed',
    hint: 'Cross your index finger over your middle finger',
    fingers: { thumb: 'bent', index: 'up_crossed', middle: 'up_crossed', ring: 'bent', pinky: 'bent' }
  },
  S: {
    emoji: '✊',
    description: 'Fist with thumb over fingers',
    hint: 'Closed fist with thumb across front of fingers',
    fingers: { thumb: 'front', index: 'bent', middle: 'bent', ring: 'bent', pinky: 'bent' }
  },
  T: {
    emoji: '🤜',
    description: 'Thumb between index and middle',
    hint: 'Fist with thumb peeking between index and middle finger',
    fingers: { thumb: 'between_index_middle', index: 'bent', middle: 'bent', ring: 'bent', pinky: 'bent' }
  },
  U: {
    emoji: '✌️',
    description: 'Index and middle fingers together, pointing up',
    hint: 'Two fingers pointing straight up, side by side',
    fingers: { thumb: 'bent', index: 'up', middle: 'up', ring: 'bent', pinky: 'bent' }
  },
  V: {
    emoji: '✌️',
    description: 'Peace sign — index and middle fingers V',
    hint: 'Index and middle fingers spread into V shape',
    fingers: { thumb: 'bent', index: 'up_spread', middle: 'up_spread', ring: 'bent', pinky: 'bent' }
  },
  W: {
    emoji: '🤟',
    description: 'Three fingers up — W shape',
    hint: 'Index, middle, ring fingers all point up and spread',
    fingers: { thumb: 'bent', index: 'up', middle: 'up', ring: 'up', pinky: 'bent' }
  },
  X: {
    emoji: '☝️',
    description: 'Index finger bent/hooked',
    hint: 'Index finger crooks/hooks, like a hook shape',
    fingers: { thumb: 'bent', index: 'hooked', middle: 'bent', ring: 'bent', pinky: 'bent' }
  },
  Y: {
    emoji: '🤙',
    description: 'Hang loose — thumb and pinky extended',
    hint: 'Thumb and pinky extend, other fingers bent',
    fingers: { thumb: 'up', index: 'bent', middle: 'bent', ring: 'bent', pinky: 'up' }
  },
  Z: {
    emoji: '☝️',
    description: 'Index finger traces Z in air',
    hint: 'Index finger extended, trace a Z shape',
    fingers: { thumb: 'bent', index: 'up', middle: 'bent', ring: 'bent', pinky: 'bent' },
    motion: true
  }
};

// SVG paths for drawing each letter's hand sign
// (used in the reference grid)
const ASL_COLORS = {
  A: '#ff6b6b', B: '#4ecdc4', C: '#45b7d1', D: '#96ceb4', E: '#ffeaa7',
  F: '#dda0dd', G: '#98fb98', H: '#87ceeb', I: '#f0e68c', J: '#e6e6fa',
  K: '#ffa07a', L: '#20b2aa', M: '#87cefa', N: '#ff69b4', O: '#deb887',
  P: '#90ee90', Q: '#add8e6', R: '#f08080', S: '#e0e0e0', T: '#b0c4de',
  U: '#ffb6c1', V: '#00fa9a', W: '#ff6347', X: '#40e0d0', Y: '#ee82ee', Z: '#f5deb3'
};

// MediaPipe hand landmark indices
const LANDMARK = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20
};
