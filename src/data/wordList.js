// Common 5-letter English words — used both as the pool of possible target
// words and as the list of accepted guesses. Kept to everyday words on
// purpose, so neither of you needs a dictionary to play fairly.

const WORDS = [
  'about', 'above', 'after', 'again', 'agree', 'ahead', 'alive', 'allow', 'alone', 'along',
  'amber', 'among', 'angel', 'anger', 'angle', 'apple', 'arena', 'argue', 'arise', 'armor',
  'aside', 'asset', 'audio', 'aunt', 'award', 'aware', 'badge', 'baker', 'balmy', 'banjo',
  'basic', 'basil', 'beach', 'beard', 'beast', 'begin', 'below', 'bench', 'berry', 'birth',
  'black', 'blaze', 'bless', 'blind', 'bliss', 'block', 'bloom', 'blush', 'board', 'boast',
  'boost', 'brave', 'bread', 'break', 'brick', 'bride', 'brief', 'bring', 'broad', 'broom',
  'brown', 'brush', 'build', 'bunny', 'buyer', 'cabin', 'cable', 'candy', 'canoe', 'cargo',
  'carve', 'catch', 'cause', 'chair', 'chalk', 'charm', 'chase', 'cheap', 'check', 'cheer',
  'chess', 'chest', 'chief', 'child', 'chill', 'choir', 'chord', 'civic', 'claim', 'class',
  'clean', 'clear', 'climb', 'clock', 'close', 'cloth', 'cloud', 'clown', 'coach', 'coast',
  'comet', 'comfy', 'comic', 'coral', 'couch', 'could', 'count', 'court', 'cover', 'craft',
  'crane', 'crazy', 'cream', 'creek', 'crisp', 'cross', 'crowd', 'crown', 'crumb', 'crush',
  'curly', 'curve', 'dance', 'dandy', 'dealt', 'dream', 'dress', 'drift', 'drink', 'drive',
  'early', 'earth', 'eight', 'elbow', 'empty', 'enjoy', 'enter', 'equal', 'exact', 'extra',
  'faith', 'false', 'fancy', 'feast', 'fence', 'ferry', 'field', 'fiery', 'first', 'flame',
  'flash', 'fleet', 'float', 'flock', 'flood', 'floor', 'flour', 'flute', 'focus', 'fresh',
  'front', 'frost', 'fruit', 'funny', 'giant', 'given', 'glory', 'grace', 'grade', 'grain',
  'grand', 'grape', 'graph', 'grass', 'great', 'green', 'greet', 'grief', 'grill', 'grind',
  'groom', 'group', 'grove', 'guard', 'guess', 'guest', 'guide', 'happy', 'harsh', 'heart',
  'heavy', 'hobby', 'honey', 'honor', 'horse', 'hotel', 'house', 'human', 'humor', 'ideal',
  'image', 'index', 'inner', 'input', 'ivory', 'jewel', 'joint', 'jolly', 'joyful', 'juicy',
  'jumpy', 'kayak', 'kitty', 'knock', 'known', 'label', 'labor', 'laugh', 'layer', 'learn',
  'lemon', 'level', 'light', 'limit', 'lodge', 'lofty', 'loyal', 'lucky', 'lunar', 'lunch',
  'lyric', 'magic', 'major', 'maker', 'mango', 'maple', 'march', 'marsh', 'match', 'mercy',
  'merry', 'metal', 'mango', 'mirth', 'money', 'month', 'moral', 'motor', 'mount', 'mouse',
  'mouth', 'movie', 'music', 'naive', 'newer', 'night', 'noble', 'north', 'noted', 'novel',
  'nurse', 'ocean', 'offer', 'olive', 'onion', 'opera', 'orbit', 'other', 'outer', 'oyster',
  'paint', 'panel', 'panic', 'party', 'peace', 'peach', 'pearl', 'phase', 'photo', 'piano',
  'piece', 'pilot', 'pixel', 'pizza', 'place', 'plain', 'plane', 'plant', 'plate', 'plaza',
  'point', 'polar', 'porch', 'power', 'press', 'pride', 'prize', 'proud', 'pulse', 'pupil',
  'puppy', 'purse', 'quart', 'quest', 'quiet', 'quilt', 'quirk', 'radio', 'rainy', 'ranch',
  'rapid', 'ready', 'realm', 'rebel', 'refer', 'relax', 'reply', 'rider', 'ridge', 'right',
  'rigid', 'risky', 'river', 'roast', 'robin', 'robot', 'rocky', 'roman', 'rough', 'round',
  'route', 'royal', 'rugby', 'ruler', 'rural', 'sadly', 'salad', 'salsa', 'salty', 'sandy',
  'sauce', 'scale', 'scarf', 'scene', 'scent', 'scoop', 'scope', 'score', 'scout', 'sense',
  'serve', 'seven', 'shade', 'shape', 'share', 'shark', 'sharp', 'sheep', 'sheet', 'shelf',
  'shell', 'shift', 'shine', 'shiny', 'shirt', 'shock', 'shoot', 'shore', 'short', 'shout',
  'showy', 'sight', 'silky', 'silly', 'since', 'siren', 'sixth', 'skate', 'skill', 'skirt',
  'skull', 'slate', 'sleek', 'sleep', 'slice', 'slide', 'small', 'smart', 'smile', 'smoke',
  'snack', 'snail', 'snake', 'sniff', 'snowy', 'solar', 'solid', 'sonic', 'sooth', 'sorry',
  'sound', 'south', 'space', 'spark', 'speak', 'speed', 'spell', 'spend', 'spice', 'spicy',
  'spine', 'spoon', 'sport', 'spray', 'squad', 'stack', 'staff', 'stage', 'stair', 'stamp',
  'stand', 'stark', 'start', 'state', 'steak', 'steam', 'steel', 'steep', 'stern', 'stick',
  'stock', 'stone', 'store', 'storm', 'story', 'stove', 'straw', 'strip', 'study', 'stuff',
  'style', 'sugar', 'suite', 'sunny', 'super', 'sweet', 'swift', 'swing', 'sword', 'syrup',
  'table', 'taste', 'teach', 'teddy', 'thank', 'theme', 'there', 'thick', 'thing', 'think',
  'third', 'thorn', 'those', 'three', 'throw', 'thumb', 'tiger', 'tight', 'timer', 'title',
  'toast', 'today', 'token', 'tonic', 'tooth', 'topic', 'torch', 'total', 'touch', 'tough',
  'towel', 'tower', 'toxic', 'trace', 'track', 'trade', 'trail', 'train', 'treat', 'trend',
  'trial', 'tribe', 'trick', 'truck', 'truly', 'trust', 'truth', 'tulip', 'tummy', 'twice',
  'twist', 'ultra', 'uncle', 'under', 'union', 'unity', 'until', 'upper', 'urban', 'usual',
  'valid', 'value', 'vapor', 'venue', 'video', 'vinyl', 'viral', 'virus', 'vivid', 'vocal',
  'voice', 'vowel', 'wagon', 'waist', 'watch', 'water', 'weary', 'weave', 'wedge', 'weird',
  'whale', 'wheat', 'wheel', 'where', 'which', 'while', 'white', 'whole', 'wider', 'width',
  'windy', 'witty', 'woman', 'world', 'worry', 'worth', 'wound', 'woven', 'wrist', 'write',
  'wrong', 'yield', 'young', 'youth', 'zesty',
]

// A handful of words are 6 letters long above by accident of editing —
// filter to a strict 5-letter list so the game grid is always consistent.
export const WORD_LIST = [...new Set(WORDS.filter((w) => w.length === 5))]

export function randomTargetWord() {
  return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)]
}

export function isValidGuess(word) {
  return WORD_LIST.includes(word.toLowerCase())
}
