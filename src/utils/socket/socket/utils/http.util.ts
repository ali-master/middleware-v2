import axios, { AxiosError } from "axios";
// Types
import type { HttpInstanceModel } from "@root/utils/socket/socket/models/http-instance.model";

export function httpInstance({ baseURL }: HttpInstanceModel) {
  const instance = axios.create({
    baseURL,
  });
  instance.defaults.headers.common["Accept-Encoding"] = "gzip";

  instance.interceptors.response.use(
    (response) => {
      return response.data ?? response;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    },
  );

  return instance;
}
