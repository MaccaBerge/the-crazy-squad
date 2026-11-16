// Tiny dependency-free PNG writer and sprite-sheet packer for the hand-typed pixel art in art/.
import zlib from 'node:zlib';

export function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Packs frames (arrays of equal-length strings, one char per pixel) into a grid; '.' is transparent. */
export function sheet(frames, palette, size, columns, scale = 1) {
  const rows = Math.ceil(frames.length / columns);
  const W = columns * size * scale, H = rows * size * scale;
  const px = new Uint8Array(W * H * 4);
  frames.forEach((f, i) => {
    if (f.length !== size) throw new Error(`frame ${i} has ${f.length} rows`);
    f.forEach((row, y) => {
      if (row.length !== size) throw new Error(`frame ${i} row ${y} is ${row.length} wide: "${row}"`);
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const c = palette[ch];
        if (c === undefined) throw new Error(`frame ${i} row ${y}: unknown colour "${ch}"`);
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
          const X = ((i % columns) * size + x) * scale + sx, Y = (Math.floor(i / columns) * size + y) * scale + sy;
          px.set([(c >> 16) & 255, (c >> 8) & 255, c & 255, 255], (Y * W + X) * 4);
        }
      });
    });
  });
  return png(W, H, px);
}
