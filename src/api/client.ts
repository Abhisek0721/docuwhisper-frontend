import axios from "axios";
import {
  getUserAccessToken,
  removeUserAccessToken,
} from "../utils/localStorageUtils";
import { envConstant } from "../constants/index";

const axiosClient = axios.create({
  baseURL: envConstant.BACKEND_BASE_URL,
  // timeout: 500000, // Request timeout
});

axiosClient.interceptors.request.use(
  (config) => {
    // Determine the appropriate token based on the route
    const token = getUserAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error instanceof Error ? error : new Error(error))
);

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      removeUserAccessToken();

      // Redirect to the sign-in page
      window.location.href = "/login";
    } else {
      console.error("API Error:", error.response || error.message);
    }

    return Promise.reject(error instanceof Error ? error : new Error(error))
  }
);

export default axiosClient;
