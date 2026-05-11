/// <reference types="vite/client" />

import type { CatMemeApi } from '../../preload'

declare global {
  interface Window {
    catMeme: CatMemeApi
  }
}
