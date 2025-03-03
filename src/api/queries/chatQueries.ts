import axiosClient from "../client";

export const askQueryToAI = async ({documentId, query}: {documentId: string, query: string}) => {
  const { data } = await axiosClient.post(`/chat/query`, {
    documentId: documentId,
    query: query,
  });
  return data;
};

export const textToSpeechApi = async ({text, voiceId, modelId}: {text: string, voiceId: string, modelId: string}) => {
  const { data } = await axiosClient.post(`/chat/text-to-speech`, {
    text: text,
    voiceId: voiceId,
    modelId: modelId,
  }, {
    responseType: 'arraybuffer',
  });
  return data;
};
