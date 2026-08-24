// Concrete, drawable nouns — deliberately not restricted to any letter
// count, unlike the Word Game list, since these just need to be sketchable.

export const PICTIONARY_WORDS = [
  'guitar', 'umbrella', 'castle', 'rocket', 'octopus', 'bicycle', 'volcano', 'dragon',
  'sandwich', 'kite', 'lighthouse', 'penguin', 'robot', 'campfire', 'waterfall', 'balloon',
  'cactus', 'anchor', 'butterfly', 'snowman', 'pirate', 'treasure chest', 'unicorn', 'jellyfish',
  'skateboard', 'telescope', 'windmill', 'igloo', 'mermaid', 'dinosaur', 'saxophone', 'tornado',
  'campervan', 'flamingo', 'hourglass', 'lantern', 'maze', 'paintbrush', 'pyramid', 'rainbow',
  'scarecrow', 'seahorse', 'spaceship', 'submarine', 'teapot', 'wizard', 'accordion', 'avocado',
  'bee', 'binoculars', 'bonfire', 'bridge', 'bubble', 'cake', 'camera', 'canoe',
  'carousel', 'chandelier', 'cheese', 'chess piece', 'chimney', 'cloud', 'compass', 'cowboy hat',
  'crab', 'crown', 'diver', 'domino', 'drum', 'earbuds', 'elephant', 'escalator',
  'fan', 'ferris wheel', 'firefighter', 'fireworks', 'fishbowl', 'flashlight', 'fountain', 'fox',
  'garden gnome', 'globe', 'hammock', 'harp', 'hedgehog', 'helicopter', 'hot air balloon', 'ice cream cone',
  'jack-o-lantern', 'kangaroo', 'ladder', 'llama', 'magnet', 'mailbox', 'moon', 'mountain',
  'mushroom', 'octopus tentacle', 'owl', 'palm tree', 'panda', 'parachute', 'peacock', 'piano',
  'picnic basket', 'pinwheel', 'planet', 'pretzel', 'pumpkin', 'raccoon', 'sailboat', 'sandcastle',
  'saturn', 'scuba diver', 'shark', 'sled', 'snail', 'snorkel', 'snowflake', 'spider web',
  'staircase', 'starfish', 'suitcase', 'sundial', 'surfboard', 'swan', 'telephone booth', 'tent',
  'thermometer', 'tightrope walker', 'toaster', 'tractor', 'traffic light', 'trampoline', 'tricycle', 'trophy',
  'tumbleweed', 'turtle', 'vending machine', 'vineyard', 'volleyball', 'waffle', 'wagon wheel', 'watering can',
  'weathervane', 'whale', 'wishing well', 'wolf', 'wrench', 'xylophone', 'yo-yo', 'zebra',
]

export function randomPictionaryWord() {
  return PICTIONARY_WORDS[Math.floor(Math.random() * PICTIONARY_WORDS.length)]
}
