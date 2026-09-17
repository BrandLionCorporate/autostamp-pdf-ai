import { CompanyInfo } from "../types";

export const analyzeDocument = async (
  imageBase64: string,
  pdfText = "",
  firstPageBase64: string | null = null,
): Promise<CompanyInfo> => {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, pdfText, firstPageBase64 }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Erro HTTP ${response.status}`);
  }

  return data as CompanyInfo;
};
