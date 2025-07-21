import { API_BASE_URL } from "./apiConfig";

export interface Transaction {
  transactionId: number;
  date: string;
  note: string;
  amount: number;
  categoryId: number;
  accountId: number;
  category: {
    categoryId: number;
    name: string;
    type: string;
  } | null;
  account: {
    accountId: number;
    name: string;
  } | null;
  isIncome: boolean;
}

export const getTransactions = async (): Promise<Transaction[]> => {
  const response = await fetch(`${API_BASE_URL}/transactions`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to fetch transactions");
  }

  const result = await response.json();
  // The API returns { data: transactions } format
  return result.data || [];
};

export const uploadTransactions = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/transactions/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to upload file");
  }

  return response.json();
};
