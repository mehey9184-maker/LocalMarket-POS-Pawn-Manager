import { useEffect } from 'react';
import { useApp, NavTab } from '../context/AppContext';

interface KeyboardShortcutOptions {
  onOpenShortcutsHelp?: () => void;
}

export const useKeyboardShortcuts = (options?: KeyboardShortcutOptions) => {
  const {
    activeTab,
    setActiveTab,
    cart,
    clearCart,
    completeCheckout,
    setIsScannerModalOpen,
    showToast
  } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const key = e.key;

      // Ignore standard typing in form inputs unless Ctrl/Cmd or functional keys are pressed
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // --- TAB SWITCHING: Ctrl+1 through Ctrl+5 OR Alt+1 through Alt+5 OR F1-F5 ---
      if ((isCtrlOrCmd || isAlt) && !e.shiftKey) {
        let targetTab: NavTab | null = null;
        if (key === '1') targetTab = 'home';
        else if (key === '2') targetTab = 'sell';
        else if (key === '3') targetTab = 'buy-pawn';
        else if (key === '4') targetTab = 'inventory';
        else if (key === '5') targetTab = 'customers';
        else if (key === '6') targetTab = 'profile';

        if (targetTab) {
          e.preventDefault();
          setActiveTab(targetTab);
          const tabNames: Record<NavTab, string> = {
            landing: 'System Overview',
            auth: 'Authentication Portal',
            'shop-setup': 'Initial Store Configuration',
            home: 'Command Center Home',
            sell: 'Front POS Terminal',
            'buy-pawn': 'Buy / Pawn Intake Desk',
            inventory: 'Vault & Stockroom Manager',
            customers: 'Consolidated Records & Clients',
            profile: 'Cashier Profile & Performance',
            vault: 'Secure Vault Operations',
            saps: 'SAPS Form 21 Statutory Register'
          };
          showToast(`Switched Tab`, tabNames[targetTab], 'info');
          return;
        }
      }

      // F1 - F5 keys for fast dedicated POS keyboard navigation
      if (!isInput) {
        if (key === 'F1') {
          e.preventDefault();
          setActiveTab('home');
          showToast('Switched Tab', 'Command Center Home [F1]', 'info');
          return;
        } else if (key === 'F2') {
          e.preventDefault();
          setActiveTab('sell');
          showToast('Switched Tab', 'Front POS Terminal [F2]', 'info');
          return;
        } else if (key === 'F3') {
          e.preventDefault();
          setActiveTab('buy-pawn');
          showToast('Switched Tab', 'Buy / Pawn Intake Desk [F3]', 'info');
          return;
        } else if (key === 'F4') {
          e.preventDefault();
          setActiveTab('inventory');
          showToast('Switched Tab', 'Vault & Stockroom Manager [F4]', 'info');
          return;
        } else if (key === 'F5' && isCtrlOrCmd) {
          // let normal refresh happen if Ctrl+F5, otherwise switch
        } else if (key === 'F5' && !isCtrlOrCmd) {
          e.preventDefault();
          setActiveTab('customers');
          showToast('Switched Tab', 'Consolidated Registry & SAPS [F5]', 'info');
          return;
        } else if (key === 'F6') {
          e.preventDefault();
          setActiveTab('profile');
          showToast('Switched Tab', 'Cashier Profile & Performance [F6]', 'info');
          return;
        }
      }

      // --- POS ACTION: QUICK CHECKOUT (Ctrl+Enter or F9) ---
      if ((isCtrlOrCmd && key === 'Enter') || key === 'F9') {
        if (activeTab === 'sell') {
          e.preventDefault();
          if (cart.length === 0) {
            showToast('Cart is Empty', 'Scan or click an item before checkout', 'amber');
            return;
          }
          const total = cart.reduce((sum, ci) => sum + ci.item.retailPrice * ci.quantity, 0);
          completeCheckout('cash', total, 'thermal');
          return;
        }
      }

      // --- POS ACTION: CLEAR CART (Ctrl+Backspace or Ctrl+Delete or Alt+C) ---
      if (
        (isCtrlOrCmd && (key === 'Backspace' || key === 'Delete')) ||
        (isAlt && (key === 'c' || key === 'C'))
      ) {
        if (activeTab === 'sell') {
          e.preventDefault();
          if (cart.length > 0) {
            clearCart();
            showToast('Cart Cleared', 'All line items removed from till', 'info');
          } else {
            showToast('Cart Already Empty', 'No items in till', 'info');
          }
          return;
        }
      }

      // --- BARCODE SCANNER MODAL TOGGLE (Ctrl+B or F7) ---
      if ((isCtrlOrCmd && (key === 'b' || key === 'B')) || key === 'F7') {
        e.preventDefault();
        setIsScannerModalOpen(true);
        return;
      }

      // --- SHORTCUTS HELP MODAL (Ctrl+/ or Shift+? or F12) ---
      if (
        (isCtrlOrCmd && key === '/') ||
        (key === '?' && !isInput) ||
        (key === 'F10' && !isInput)
      ) {
        e.preventDefault();
        if (options?.onOpenShortcutsHelp) {
          options.onOpenShortcutsHelp();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, setActiveTab, cart, clearCart, completeCheckout, setIsScannerModalOpen, showToast, options]);
};
