import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/familjen-grotesk/400.css'
import '@fontsource/familjen-grotesk/500.css'
import '@fontsource/familjen-grotesk/600.css'
import '@fontsource/familjen-grotesk/700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
