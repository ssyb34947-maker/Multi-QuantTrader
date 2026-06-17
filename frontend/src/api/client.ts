import axios from 'axios'
import { message } from 'antd'

const DEMO_TOKEN = 'duozhixing-demo-token'

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Demo-User': 'duozhixing',
  },
})

client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || DEMO_TOKEN
    config.headers.Authorization = `Bearer ${token}`
    config.params = { demo_user_id: 1, ...(config.params ?? {}) }
    return config
  },
  (error) => Promise.reject(error),
)

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const msg = error.response?.data?.message || error.message || '请求失败'
    if (error.response?.status !== 401) {
      message.error(msg)
    }
    return Promise.reject(error)
  },
)

export default client
