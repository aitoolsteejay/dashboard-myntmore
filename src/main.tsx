import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from './router'
import './styles.css'

// After a new deploy, a tab left open from before can try to dynamically
// import a route chunk whose hashed filename no longer exists. That throws
// before React mounts, so it skips our error boundaries and shows a blank
// page. Detect that specific failure and force one reload to pick up the
// new build; the sessionStorage guard stops a reload loop if it keeps failing.
function isStaleChunkError(message: unknown): boolean {
  if (typeof message !== 'string') return false
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically imported module/i.test(message)
}

function recoverFromStaleChunk() {
  const key = 'chunk-reload-attempted'
  if (sessionStorage.getItem(key)) return
  sessionStorage.setItem(key, '1')
  window.location.reload()
}

window.addEventListener('unhandledrejection', (event) => {
  if (isStaleChunkError(event.reason?.message ?? event.reason)) {
    recoverFromStaleChunk()
  }
})

window.addEventListener('error', (event) => {
  if (isStaleChunkError(event.message)) {
    recoverFromStaleChunk()
  }
})

const router = getRouter()

// Prevent mouse-wheel and trackpad scrolling from silently changing focused
// number inputs. Capture runs before the browser's native increment/decrement
// behavior, while leaving the wheel event untouched so the page still scrolls.
document.addEventListener('wheel', event => {
  const target = event.target
  if (target instanceof HTMLInputElement && target.type === 'number' && document.activeElement === target) {
    target.blur()
  }
}, { capture: true, passive: true })

ReactDOM.createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

sessionStorage.removeItem('chunk-reload-attempted')
