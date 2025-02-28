import axiosClient from "../client";

export const askQueryToAI = async ({documentId, query}: {documentId: string, query: string}) => {
  const { data } = await axiosClient.post(`/chat/query`, {
    documentId: documentId,
    query: query,
  });
  return data;
};
