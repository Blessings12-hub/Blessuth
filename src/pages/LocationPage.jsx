import { useNavigate } from 'react-router-dom'
import DistanceWidget from '../components/DistanceWidget'
import { MapPinIcon } from '../components/Icons'

export default function LocationPage() {
  const navigate = useNavigate()

  return (
    <main className="page-shell page-shell-spacious">
      <header className="page-header">
        <button className="icon-button" type="button" onClick={() => navigate(-1)} aria-label="Go back">
          Back
        </button>
        <div className="page-header-title">
          <MapPinIcon size={22} />
          <div>
            <p className="eyebrow">Together, wherever you are</p>
            <h1>Share your location</h1>
          </div>
        </div>
      </header>

      <section className="content-section location-page-intro" aria-labelledby="location-heading">
        <h2 id="location-heading">Keep each other close</h2>
        <p>
          Turn this on to share your latest location with your partner. Your location is only shared with your paired account and stops updating when you turn it off.
        </p>
      </section>

      <DistanceWidget />

      <p className="location-page-note">
        Location access is handled by your device. For the most reliable updates, keep Blessuth open while sharing.
      </p>
    </main>
  )
}
