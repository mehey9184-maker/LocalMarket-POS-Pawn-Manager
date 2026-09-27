import React, { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import { useSellers } from '../../../context/SellerContext';

interface SellerHistoryDisplayProps {
  sellerId: string;
}

export const SellerHistoryDisplay: React.FC<SellerHistoryDisplayProps> = ({ sellerId }) => {
  const { getSellerTransactions } = useSellers();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    getSellerTransactions(sellerId).then(setHistory);
  }, [sellerId, getSellerTransactions]);

  if (history.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-[#C85A32]" />
        <h5 className="text-xs font-semibold text-gray-800">Previous Seller Transactions</h5>
      </div>
      <div className="space-y-3 divide-y divide-gray-100">
        {history.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between pt-2.5 first:pt-0">
            <div>
              <p className="text-xs font-medium text-gray-800">{tx.itemTitle}</p>
              <p className="text-[11px] text-gray-400 font-mono">{new Date(tx.timestamp).toLocaleDateString()}</p>
            </div>
            <span className="text-xs font-bold text-gray-900 font-mono">R {tx.amountPaid.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
