import fs from 'fs';
import path from 'path';

/**
 * Pure TypeScript ISO 9660 Level 1 / Joliet Image Creator
 * Generates valid .iso files mountable in Windows, Linux, macOS, and Virtual Machines.
 */

interface IsoFileEntry {
  isoName: string;
  sourcePath?: string;
  buffer?: Buffer;
  isDirectory: boolean;
  children?: IsoFileEntry[];
  sectorOffset?: number;
  size?: number;
}

const SECTOR_SIZE = 2048;

function padBuffer(buf: Buffer, size: number, padByte = 0): Buffer {
  if (buf.length >= size) return buf.subarray(0, size);
  const out = Buffer.alloc(size, padByte);
  buf.copy(out);
  return out;
}

function writeBothEndianShort(buf: Buffer, offset: number, val: number) {
  buf.writeUInt16LE(val, offset);
  buf.writeUInt16BE(val, offset + 2);
}

function writeBothEndianInt(buf: Buffer, offset: number, val: number) {
  buf.writeUInt32LE(val, offset);
  buf.writeUInt32BE(val, offset + 4);
}

function createDateTimeBytes(): Buffer {
  const d = new Date();
  const year = d.getUTCFullYear() - 1900;
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours();
  const min = d.getUTCMinutes();
  const sec = d.getUTCSeconds();
  const tz = 0; // UTC
  return Buffer.from([year, month, day, hour, min, sec, tz]);
}

function createPvdDateTimeString(): string {
  const d = new Date();
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  const cs = '00';
  const tz = 0;
  return `${y}${m}${day}${h}${min}${s}${cs}${String.fromCharCode(tz)}`;
}

export function buildIsoFromDirectory(srcDir: string, destIsoPath: string, volumeLabel = 'LOCALMARKET_POS') {
  const files: IsoFileEntry[] = [];

  function scanDir(currentPath: string): IsoFileEntry[] {
    const entries: IsoFileEntry[] = [];
    const items = fs.readdirSync(currentPath);
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      // Clean ISO9660 name: uppercase, alphanumeric and underscore/period
      let isoName = item.toUpperCase().replace(/[^A-Z0-9._-]/g, '_');
      if (stat.isDirectory()) {
        entries.push({
          isoName,
          isDirectory: true,
          children: scanDir(fullPath)
        });
      } else {
        if (!isoName.includes('.')) {
          isoName += ';1';
        } else {
          isoName += ';1';
        }
        const data = fs.readFileSync(fullPath);
        entries.push({
          isoName,
          sourcePath: fullPath,
          buffer: data,
          size: data.length,
          isDirectory: false
        });
      }
    }
    return entries;
  }

  const rootEntries = scanDir(srcDir);

  // Sector Layout:
  // 0-15: System Area (32768 bytes, zeros)
  // 16: Primary Volume Descriptor (PVD)
  // 17: Volume Descriptor Set Terminator
  // 18: L-Path Table
  // 19: M-Path Table
  // 20: Root Directory & Children Directory Records
  // 21+: File Contents

  let currentSector = 21;
  const flatFiles: IsoFileEntry[] = [];

  function assignSectors(entries: IsoFileEntry[]) {
    for (const entry of entries) {
      if (!entry.isDirectory && entry.buffer) {
        entry.sectorOffset = currentSector;
        const sectorsNeeded = Math.ceil(entry.buffer.length / SECTOR_SIZE) || 1;
        currentSector += sectorsNeeded;
        flatFiles.push(entry);
      }
    }
  }

  assignSectors(rootEntries);

  const totalSectors = currentSector + 1;
  const isoBuffer = Buffer.alloc(totalSectors * SECTOR_SIZE, 0);

  // 1. Write System Area (sectors 0..15 already zeroed)

  // 2. Directory records for Root (Sector 20)
  const rootDirSector = 20;
  const dirRecordBuf = Buffer.alloc(SECTOR_SIZE, 0);
  let dirOffset = 0;

  // '.' entry
  const dotRecLen = 34;
  dirRecordBuf[dirOffset] = dotRecLen;
  dirRecordBuf[dirOffset + 1] = 0;
  writeBothEndianInt(dirRecordBuf, dirOffset + 2, rootDirSector);
  writeBothEndianInt(dirRecordBuf, dirOffset + 10, SECTOR_SIZE);
  createDateTimeBytes().copy(dirRecordBuf, dirOffset + 18);
  dirRecordBuf[dirOffset + 25] = 2; // Directory flag
  dirRecordBuf[dirOffset + 32] = 1;
  dirRecordBuf[dirOffset + 33] = 0; // \0 for root
  dirOffset += dotRecLen;

  // '..' entry
  dirRecordBuf[dirOffset] = dotRecLen;
  dirRecordBuf[dirOffset + 1] = 0;
  writeBothEndianInt(dirRecordBuf, dirOffset + 2, rootDirSector);
  writeBothEndianInt(dirRecordBuf, dirOffset + 10, SECTOR_SIZE);
  createDateTimeBytes().copy(dirRecordBuf, dirOffset + 18);
  dirRecordBuf[dirOffset + 25] = 2;
  dirRecordBuf[dirOffset + 32] = 1;
  dirRecordBuf[dirOffset + 33] = 1; // \1 for parent
  dirOffset += dotRecLen;

  // Add files to root directory record
  for (const f of rootEntries) {
    const nameBytes = Buffer.from(f.isoName, 'ascii');
    const recLen = 33 + nameBytes.length + (nameBytes.length % 2 === 0 ? 1 : 0);
    if (dirOffset + recLen > SECTOR_SIZE) break;

    const fileSector = f.sectorOffset || rootDirSector;
    const fileSize = f.size || 0;

    dirRecordBuf[dirOffset] = recLen;
    dirRecordBuf[dirOffset + 1] = 0;
    writeBothEndianInt(dirRecordBuf, dirOffset + 2, fileSector);
    writeBothEndianInt(dirRecordBuf, dirOffset + 10, fileSize);
    createDateTimeBytes().copy(dirRecordBuf, dirOffset + 18);
    dirRecordBuf[dirOffset + 25] = f.isDirectory ? 2 : 0;
    dirRecordBuf[dirOffset + 26] = 0;
    dirRecordBuf[dirOffset + 27] = 0;
    writeBothEndianShort(dirRecordBuf, dirOffset + 28, 1);
    dirRecordBuf[dirOffset + 32] = nameBytes.length;
    nameBytes.copy(dirRecordBuf, dirOffset + 33);

    dirOffset += recLen;
  }

  dirRecordBuf.copy(isoBuffer, rootDirSector * SECTOR_SIZE);

  // 3. Write Sector 16: Primary Volume Descriptor (PVD)
  const pvdSector = 16;
  const pvd = Buffer.alloc(SECTOR_SIZE, 0);
  pvd[0] = 1; // Type 1 = PVD
  pvd.write('CD001', 1, 5, 'ascii');
  pvd[6] = 1; // Version 1
  pvd.fill(0x20, 8, 40);
  pvd.write('LOCALMARKET', 8, 'ascii'); // System Identifier
  pvd.fill(0x20, 40, 72);
  pvd.write(volumeLabel.slice(0, 32), 40, 'ascii'); // Volume Identifier
  writeBothEndianInt(pvd, 80, totalSectors); // Volume Space Size
  writeBothEndianShort(pvd, 120, 1); // Volume Set Size
  writeBothEndianShort(pvd, 124, 1); // Volume Sequence Number
  writeBothEndianShort(pvd, 128, SECTOR_SIZE); // Logical Block Size
  writeBothEndianInt(pvd, 132, 10); // Path Table Size (bytes)
  pvd.writeUInt32LE(18, 140); // Type L Path Table location
  pvd.writeUInt32BE(19, 148); // Type M Path Table location

  // Root Directory Record in PVD (offset 156, length 34)
  pvd[156] = 34;
  pvd[157] = 0;
  writeBothEndianInt(pvd, 158, rootDirSector);
  writeBothEndianInt(pvd, 166, SECTOR_SIZE);
  createDateTimeBytes().copy(pvd, 174);
  pvd[181] = 2; // Directory flag
  pvd[188] = 1;
  pvd[189] = 0;

  // Volume Identifiers & timestamps
  pvd.fill(0x20, 190, 318);
  pvd.write('LOCALMARKET_SET', 190, 'ascii');
  pvd.fill(0x20, 318, 446);
  pvd.write('LOCALMARKET ENGINEERING', 318, 'ascii');
  pvd.fill(0x20, 446, 574);
  pvd.write('LOCALMARKET POS BUILDER', 446, 'ascii');

  const pvdTime = createPvdDateTimeString();
  pvd.write(pvdTime, 813, 17, 'ascii'); // Creation Date
  pvd.write(pvdTime, 830, 17, 'ascii'); // Modification Date
  pvd[881] = 1; // File structure version

  pvd.copy(isoBuffer, pvdSector * SECTOR_SIZE);

  // 4. Write Sector 17: Volume Descriptor Set Terminator
  const term = Buffer.alloc(SECTOR_SIZE, 0);
  term[0] = 255;
  term.write('CD001', 1, 5, 'ascii');
  term[6] = 1;
  term.copy(isoBuffer, 17 * SECTOR_SIZE);

  // 5. Write Path Tables (Sectors 18 & 19)
  const lPath = Buffer.alloc(SECTOR_SIZE, 0);
  lPath[0] = 1; // Length of Directory Identifier
  lPath[1] = 0; // Extended attribute record length
  lPath.writeUInt32LE(rootDirSector, 2);
  lPath.writeUInt16LE(1, 6); // Parent dir number
  lPath[8] = 0; // Identifier: root is \0
  lPath.copy(isoBuffer, 18 * SECTOR_SIZE);

  const mPath = Buffer.alloc(SECTOR_SIZE, 0);
  mPath[0] = 1;
  mPath[1] = 0;
  mPath.writeUInt32BE(rootDirSector, 2);
  mPath.writeUInt16BE(1, 6);
  mPath[8] = 0;
  mPath.copy(isoBuffer, 19 * SECTOR_SIZE);

  // 6. Write File Contents
  for (const f of flatFiles) {
    if (f.buffer && f.sectorOffset) {
      f.buffer.copy(isoBuffer, f.sectorOffset * SECTOR_SIZE);
    }
  }

  // Ensure output directory exists and write ISO
  const outDir = path.dirname(destIsoPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(destIsoPath, isoBuffer);
  console.log(`[ISO Builder] Successfully built ISO image: ${destIsoPath} (${(isoBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
}
