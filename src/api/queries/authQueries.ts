import axiosClient from "../client";

export const googleLogin = async () => {
  const { data } = await axiosClient.get("/api/auth/google");
  return data;
};


