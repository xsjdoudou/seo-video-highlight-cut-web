import { useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import DemoShowcase from './components/DemoShowcase'
import ClipModal from './components/ClipModal'
import type { Clip } from './data/clips'

export default function App() {
  const [activeClip, setActiveClip] = useState<Clip | null>(null)

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <DemoShowcase onOpenClip={setActiveClip} paused={activeClip !== null} />
      </main>
      <footer className="footer">
        © {new Date().getFullYear()} Video Highlight · AI clipping for podcasts and long-form video
      </footer>
      {activeClip && <ClipModal clip={activeClip} onClose={() => setActiveClip(null)} />}
    </>
  )
}
