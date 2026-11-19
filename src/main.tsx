import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app'
import { registerDownloadBridge } from './lib/download-bridge'
import './index.css'

registerDownloadBridge()

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
