export interface PrintableLineItem {
  description: string;
  amount: number;
}

export interface PrintableDocument {
  type: 'receipt' | 'agreement' | 'register';
  refId: string;
  shopName: string;
  timestamp: string;
  items: PrintableLineItem[];
  total: number;
}
