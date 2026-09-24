import React from 'react';
import { PrintableDocument } from '../../types/printing';

export const PrintTemplate: React.FC<{ document: PrintableDocument }> = ({ document }) => {
  return (
    <div className="print-content">
      <header>
        <h1>{document.shopName}</h1>
        <p className="doc-type">{document.type.toUpperCase()}</p>
        <p>Reference: {document.refId}</p>
        <p>Date: {new Date(document.timestamp).toLocaleString()}</p>
      </header>
      
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {document.items.map((item, index) => (
            <tr key={index}>
              <td>{item.description}</td>
              <td className="amount">R {item.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td><strong>Total</strong></td>
            <td className="amount"><strong>R {document.total.toFixed(2)}</strong></td>
          </tr>
        </tfoot>
      </table>
      
      <footer>
        <p>Thank you for your business.</p>
      </footer>
    </div>
  );
};
