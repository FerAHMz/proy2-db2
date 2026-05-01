import axios, { AxiosError } from 'axios'

const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<{ error?: string; code?: string }>) => {
    const status = err.response?.status ?? 0
    const message =
      err.response?.data?.error ||
      err.message ||
      `Request failed (${status})`
    return Promise.reject(new ApiError(message, status, err.response?.data?.code))
  },
)

export const apiBaseUrl = () => baseURL
