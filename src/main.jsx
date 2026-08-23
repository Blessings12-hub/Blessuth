import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { registerServiceWorker } from './push.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

registerServiceWorker().catch(() => {
  // Push just won't be available on this browser — the rest of the app
  // works fine without it.
})
