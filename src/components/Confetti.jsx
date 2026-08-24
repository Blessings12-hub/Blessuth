export default function Confetti() {
  const pieces = Array.from({ length: 18 })
  return (
    <div className="confetti-burst" aria-hidden="true">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i / pieces.length) * 100}%`,
            animationDelay: `${(i % 6) * 0.08}s`,
            background: ['var(--sunset)', 'var(--gold)', 'var(--teal)'][i % 3],
          }}
        />
      ))}
    </div>
  )
}
