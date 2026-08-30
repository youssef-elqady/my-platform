import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatPhoneToEmail = (phone: string) => {
  const cleanPhone = phone.replace(/\s+/g, '');
  return `${cleanPhone}@student.ahmed-ramadan.com`;
};