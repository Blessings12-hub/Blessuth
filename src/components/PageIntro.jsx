export default function PageIntro({ eyebrow, title, description, action }) {
  return (
    <header className="page-intro">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p className="subtitle">{description}</p>}
      </div>
      {action}
    </header>
  )
}
