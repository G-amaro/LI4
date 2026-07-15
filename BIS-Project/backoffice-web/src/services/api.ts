import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5254'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' }
})

// Auto-login se não houver token válido
async function garantirToken(): Promise<void> {
  const token = localStorage.getItem('bis_admin_token')
  if (token) return

  try {
    const r = await axios.post(`${BASE_URL}/api/auth/login`, {
      email:    'orlando@bragaconvenience.pt',
      password: 'admin123'
    })
    const jwt = r.data?.token ?? r.data?.accessToken ?? r.data?.jwt
    if (jwt) localStorage.setItem('bis_admin_token', jwt)
  } catch {
    console.warn('[api] Auto-login falhou — backend offline?')
  }
}

// Inject JWT em cada request, com auto-login se necessário
api.interceptors.request.use(async (config) => {
  await garantirToken()
  const token = localStorage.getItem('bis_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Se 401 → limpa token e tenta de novo
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('bis_admin_token')
      await garantirToken()
      const token = localStorage.getItem('bis_admin_token')
      if (token && error.config && !error.config._retry) {
        error.config._retry = true
        error.config.headers.Authorization = `Bearer ${token}`
        return api(error.config)
      }
    }
    return Promise.reject(error)
  }
)
