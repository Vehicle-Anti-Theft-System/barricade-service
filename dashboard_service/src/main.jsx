import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppAgent from './AppAgent.jsx'

const isAgentMode = import.meta.env.MODE === "agent";
const RootApp = isAgentMode ? AppAgent : App;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
