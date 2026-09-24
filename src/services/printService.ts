import { createRoot } from 'react-dom/client';
import { PrintableDocument } from '../types/printing';
import { PrintTemplate } from '../components/common/PrintTemplate';
import React from 'react';

export const printService = {
  printDocument(document: PrintableDocument) {
    const printContainer = document.createElement('div');
    printContainer.id = 'print-root';
    document.body.appendChild(printContainer);

    const root = createRoot(printContainer);
    root.render(React.createElement(PrintTemplate, { document }));

    // Give React a moment to render before calling print
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.error('Print failed:', e);
      } finally {
        root.unmount();
        document.body.removeChild(printContainer);
      }
    }, 100);
  }
};
