import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AboutPage from './about/AboutPage.tsx'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AboutPage />
  </StrictMode>,
)
