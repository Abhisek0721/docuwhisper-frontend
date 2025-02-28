import axiosClient from "../client";

export const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append("document", file);
  const { data } = await axiosClient.post("/document/upload", formData);
  return data;
};

export const getAllDocuments = async () => {
  const { data } = await axiosClient.get("/document");
  return data;
};

export const deleteDocument = async (id: string) => {
  const { data } = await axiosClient.delete(`/document/${id}`);
  return data;
};




