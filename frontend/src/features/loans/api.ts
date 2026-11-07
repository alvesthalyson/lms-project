import { apiClient } from "@/api/client";
import type { Paginated } from "@/api/types";

import type { CreateLoanPayload, Loan, LoanListParams, ReturnLoanPayload, ReturnLoanResponse } from "./types";

export async function listLoans(params: LoanListParams, signal?: AbortSignal): Promise<Paginated<Loan>> {
  const { data } = await apiClient.get<Paginated<Loan>>("/loans/", { params, signal });
  return data;
}

export async function createLoan(payload: CreateLoanPayload): Promise<Loan> {
  const { data } = await apiClient.post<Loan>("/loans/", payload);
  return data;
}

export async function renewLoan(id: number): Promise<Loan> {
  const { data } = await apiClient.post<Loan>(`/loans/${id}/renew/`);
  return data;
}

export async function returnLoan(id: number, payload: ReturnLoanPayload = {}): Promise<ReturnLoanResponse> {
  const { data } = await apiClient.post<ReturnLoanResponse>(`/loans/${id}/return/`, payload);
  return data;
}
