// ESC/POS Commands
const ESC = 0x1b;
const GS = 0x1d;

const COMMANDS = {
  INIT: new Uint8Array([ESC, 0x40]),
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  TEXT_BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  TEXT_BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  TEXT_DOUBLE_SIZE: new Uint8Array([GS, 0x21, 0x11]),
  TEXT_NORMAL_SIZE: new Uint8Array([GS, 0x21, 0x00]),
  CUT_PAPER: new Uint8Array([GS, 0x56, 0x41, 0x00]),
  OPEN_CASH_DRAWER: new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xfa]),
};

export class ThermalPrinterService {
  private device: any = null;

  /** Connect via WebUSB (Epson, Xprinter, Zebra) */
  async connectUSB(): Promise<boolean> {
    try {
      const nav = navigator as any;
      if (!nav.usb) {
        console.warn('WebUSB not supported in this browser. Falling back to system print driver.');
        return false;
      }
      this.device = await nav.usb.requestDevice({ filters: [] });
      await this.device.open();
      await this.device.selectConfiguration(1);
      await this.device.claimInterface(0);
      return true;
    } catch (err) {
      console.error('USB Printer Connection Failed:', err);
      return false;
    }
  }

  /** Send raw byte stream to hardware */
  async sendRaw(data: Uint8Array): Promise<void> {
    if (this.device && this.device.opened) {
      const endpoint = this.device.configuration?.interfaces[0].alternate.endpoints.find(
        (e: any) => e.direction === 'out'
      );
      if (endpoint) {
        await this.device.transferOut(endpoint.endpointNumber, data);
        return;
      }
    }
    // Fallback: Trigger browser print dialog for simulated slip
    window.print();
  }

  /** Trigger Solenoid Kick for Cash Drawer */
  async kickCashDrawer(): Promise<void> {
    await this.sendRaw(COMMANDS.OPEN_CASH_DRAWER);
  }

  /** Generate and print Front POS Receipt */
  async printReceipt(order: {
    ticketNo: string;
    items: Array<{ title: string; price: number; sn: string }>;
    subtotal: number;
    vat: number;
    total: number;
    paymentMethod: string;
    cashTendered?: number;
    changeDue?: number;
  }): Promise<void> {
    const encoder = new TextEncoder();
    const buffer: number[] = [];

    const append = (bytes: Uint8Array) => buffer.push(...bytes);
    const appendText = (text: string) => buffer.push(...encoder.encode(text));

    append(COMMANDS.INIT);
    append(COMMANDS.ALIGN_CENTER);
    append(COMMANDS.TEXT_DOUBLE_SIZE);
    append(COMMANDS.TEXT_BOLD_ON);
    appendText("LOCALMARKET SOWETO\n");
    append(COMMANDS.TEXT_NORMAL_SIZE);
    append(COMMANDS.TEXT_BOLD_OFF);
    appendText("Powered by LocalEats SA\n");
    appendText("Soweto Main Branch - Diepkloof Zone 6\n");
    appendText("Tel: +27 11 984 4000 | SAPS Reg: SHG-JHB-88192\n");
    appendText("------------------------------------------------\n");

    append(COMMANDS.ALIGN_LEFT);
    appendText(`Receipt No: ${order.ticketNo}\n`);
    appendText(`Date: ${new Date().toLocaleString('en-ZA')}\n`);
    appendText("------------------------------------------------\n");

    order.items.forEach((item) => {
      const title = item.title.padEnd(32, ' ').slice(0, 32);
      const price = `R ${item.price.toFixed(2)}`.padStart(14, ' ');
      appendText(`${title}${price}\n`);
      if (item.sn) appendText(`   SN/IMEI: ${item.sn}\n`);
    });

    appendText("------------------------------------------------\n");
    append(COMMANDS.ALIGN_RIGHT);
    appendText(`Subtotal: R ${order.subtotal.toFixed(2)}\n`);
    appendText(`VAT (15% Inc.): R ${order.vat.toFixed(2)}\n`);
    append(COMMANDS.TEXT_BOLD_ON);
    appendText(`TOTAL: R ${order.total.toFixed(2)}\n`);
    append(COMMANDS.TEXT_BOLD_OFF);
    appendText(`Tender Method: ${order.paymentMethod}\n`);
    if (order.cashTendered) {
      appendText(`Cash Paid: R ${order.cashTendered.toFixed(2)}\n`);
      appendText(`Change Given: R ${(order.changeDue || 0).toFixed(2)}\n`);
    }

    append(COMMANDS.ALIGN_CENTER);
    appendText("\nThank you for supporting Township Commerce!\n");
    appendText("Goods bought second-hand covered by SHG Act 6 of 2009\n\n\n");
    append(COMMANDS.CUT_PAPER);

    await this.sendRaw(new Uint8Array(buffer));
  }

  /** Print 50mm x 25mm Zebra Asset Tag for Vault Storage */
  async printAssetTag(asset: {
    ticketNo: string;
    itemTitle: string;
    serialNo: string;
    vaultShelf: string;
    pledgorName: string;
    expiryDate: string;
    amount: number;
  }): Promise<void> {
    // Generate ZPL II Code for Zebra Printers
    const zpl = `
^XA
^FO30,20^A0N,25,25^FDLOCALMARKET SOWETO^FS
^FO30,50^A0N,20,20^FDPawn Asset Tag - Vault Hold^FS
^FO30,80^GB400,2,2^FS
^FO30,95^A0N,22,22^FDItem: ${asset.itemTitle.slice(0, 24)}^FS
^FO30,120^A0N,18,18^FDSN: ${asset.serialNo}^FS
^FO30,140^A0N,20,20^FDSHELF: ${asset.vaultShelf}^FS
^FO30,165^A0N,18,18^FDPledgor: ${asset.pledgorName}^FS
^FO30,185^A0N,18,18^FDExpiry: ${asset.expiryDate}^FS
^FO30,210^BY2^BCN,40,Y,N,N^FD${asset.ticketNo}^FS
^XZ
    `.trim();

    const encoder = new TextEncoder();
    await this.sendRaw(encoder.encode(zpl));
  }
}

export const thermalPrinter = new ThermalPrinterService();
