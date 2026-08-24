// Each pair is [optionA, optionB]. Kept genuinely varied — some silly, some
// a little revealing — so the comparison at the end is actually interesting.

export const THIS_OR_THAT_PAIRS = [
  ['Beach', 'Mountains'],
  ['Morning person', 'Night owl'],
  ['Coffee', 'Tea'],
  ['Sweet', 'Salty'],
  ['Book', 'Movie'],
  ['City life', 'Country life'],
  ['Summer', 'Winter'],
  ['Texting', 'Calling'],
  ['Planned trip', 'Spontaneous trip'],
  ['Cooking in', 'Eating out'],
  ['Dogs', 'Cats'],
  ['Early flight', 'Late flight'],
  ['Window seat', 'Aisle seat'],
  ['Camping', 'Hotel'],
  ['Sunrise', 'Sunset'],
  ['Comedy', 'Drama'],
  ['Board games', 'Video games'],
  ['Big party', 'Small gathering'],
  ['Save it', 'Spend it'],
  ['Quiet night in', 'Night out'],
  ['Pizza', 'Sushi'],
  ['Rain', 'Snow'],
  ['Road trip', 'Flight'],
  ['Sports on TV', 'Documentaries'],
  ['Neat & tidy', 'Lived-in mess'],
  ['Karaoke', 'Dance floor'],
  ['Slow mornings', 'Jump right in'],
  ['Gift given', 'Gift received'],
  ['Window open', 'AC on'],
  ['Text first', 'Wait for them'],
  ['Long showers', 'Quick showers'],
  ['Sweet coffee', 'Black coffee'],
  ['Weekend project', 'Weekend rest'],
  ['New restaurant', 'Old favorite'],
  ['Concert', 'Museum'],
  ['Deep talk', 'Easy banter'],
  ['Blanket hog', 'Blanket sharer'],
  ['Plan the date', 'Surprise me'],
  ['Handwritten note', 'Thoughtful text'],
  ['Adventure park', 'Spa day'],
]

export function seededShuffle(array, seed) {
  // Simple deterministic PRNG (xorshift32) seeded from a string — given the
  // same seed, every client produces the exact same shuffle order. That's
  // essential here: both partners must see pairs in the identical order for
  // their answers to be comparable index-by-index.
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  let state = (h >>> 0) || 1
  function rand() {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 4294967296
  }
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
