// A mix of movies, idioms, and everyday phrases — the clue-giver picks one
// (secretly) and translates it into emojis for their partner to guess.

export const EMOJI_PHRASES = [
  'The Lion King', 'Titanic', 'Finding Nemo', 'Jurassic Park', 'The Little Mermaid',
  'Home Alone', 'Frozen', 'Toy Story', 'Shark Tank', 'Beauty and the Beast',
  'Harry Potter', 'Star Wars', 'The Matrix', 'Jaws', 'Up',
  'Cinderella', 'Moana', 'Ratatouille', 'The Notebook', 'Fast and Furious',
  'break the ice', 'piece of cake', 'raining cats and dogs', 'once in a blue moon', 'spill the beans',
  'cost an arm and a leg', 'under the weather', 'break a leg', 'a piece of my mind', 'let the cat out of the bag',
  'butterflies in my stomach', 'on cloud nine', 'the ball is in your court', 'hit the nail on the head', 'when pigs fly',
  'best friends forever', 'happy birthday', 'good morning sunshine', 'movie night', 'road trip',
  'date night', 'first kiss', 'love at first sight', 'home sweet home', 'coffee break',
  'beach vacation', 'snow day', 'birthday cake', 'wedding day', 'new year',
  'pizza party', 'game night', 'sleepy Sunday', 'ice cream date', 'sunset walk',
  'thunderstorm', 'rainbow after rain', 'shooting star', 'full moon', 'campfire story',
]

export function randomEmojiPhrase() {
  return EMOJI_PHRASES[Math.floor(Math.random() * EMOJI_PHRASES.length)]
}
