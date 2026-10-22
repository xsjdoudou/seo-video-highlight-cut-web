import { useRef, useState, type FormEvent } from 'react'
import { LinkIcon } from './icons'

export default function Hero() {
  const [url, setUrl] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setNotice(url.trim() ? 'Thanks! Clipping from links is coming soon.' : 'Paste a video link first.')
  }

  return (
    <section className="hero">
      <h1 className="hero__title">
        Turn long videos into <span className="hero__accent">viral shorts</span>
      </h1>
      <p className="hero__subtitle">
        Video Highlight turns long videos into shorts, and publishes them to all social platforms in one click.
      </p>
      <form className="hero__actions" onSubmit={onSubmit}>
        <div className="link-input">
          <LinkIcon />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Drop a video link"
            aria-label="Video link"
          />
          <button type="submit" className="btn btn--light btn--lg">Get free clips</button>
        </div>
        <span className="hero__or">or</span>
        <button type="button" className="btn btn--outline btn--lg" onClick={() => fileInput.current?.click()}>
          Upload files
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => e.target.files?.length && setNotice(`Selected ${e.target.files[0].name} – uploads are coming soon.`)}
        />
      </form>
      <p className="hero__notice" role="status">{notice}</p>
    </section>
  )
}
