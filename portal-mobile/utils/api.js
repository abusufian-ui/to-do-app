import axios from "axios";

// Replace this with your actual Render URL (make sure to include /api if your routes use it)
const BACKEND_URL =
  "https://to-do-web-01.onrender.com" || "http://localhost:5000";

const api = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
