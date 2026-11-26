import { keepDisplayP3, readDisplayP3Profile } from '../lib/color-profile';
import { FORMAT_META } from '../lib/files';
import type { EncodeRequest, EncodeResponse, OutputFormat } from '../types';
import quantizerWasmUrl from 'libimagequant-wasm/wasm/libimagequant_wasm_bg.wasm?url';
import {
  loadJpegEncoder,
  loadOxipng,
  loadWebpEncoder,
  type JpegEncodeOptions,
  type WebpEncodeOptions,
} from './codecs';

const PNG_PIXEL_LIMIT = 16_777_216;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
// Level 3 took ~4x longer than level 2 on a 12MP image for a ~0.06% size gain, which made
// large PNG conversions look stuck (and multiplied the cost in byte-target search).
const OXIPNG_LEVEL = 2;
const WHITE = '#ffffff';

let quantizerWasm: Promise<
  typeof import('libimagequant-wasm/wasm/libimagequant_wasm.js')
> | null = null;

interface Surface {
  canvas: OffscreenCanvas;
  context: OffscreenCanvasRenderingContext2D;
  keepProfile: boolean;
}

self.onmessage = async (event: MessageEvent<EncodeRequest>) => {
  await encode(event.data);
};

async function encode(request: EncodeRequest) {
  const {
    id,
    source,
    format,
    quality,
    width,
    height,
    optimize = true,
  } = request;

  try {
    if (width < 1 || height < 1) throw new Error('size');

    const profile =
      format === 'png'
        ? null
        : await readDisplayP3Profile(source).catch(() => null);
    const bitmap = await createImageBitmap(source);
    try {
      const encoded =
        format === 'png'
          ? await encodePng(source, bitmap, width, height, quality, optimize)
          : await encodeLossy(bitmap, format, quality, width, height, profile);
      const blob = keepSourceIfSmaller(
        source,
        encoded,
        format,
        bitmap,
        width,
        height,
      );
      post({ id, blob });
    } finally {
      bitmap.close();
    }
  } catch (error) {
    post({ id, error: describeError(error) });
  }
}

function post(response: EncodeResponse) {
  self.postMessage(response);
}

function describeError(error: unknown) {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

/**
 * Re-encoding an already compressed file at the same size can make it larger. In that case the
 * untouched source is returned instead: identical pixels and a file that is never bigger.
 */
function keepSourceIfSmaller(
  source: Blob,
  encoded: Blob,
  format: OutputFormat,
  bitmap: ImageBitmap,
  width: number,
  height: number,
) {
  const isSameFormat = source.type === FORMAT_META[format].mime;
  const isSameSize = bitmap.width === width && bitmap.height === height;
  return isSameFormat && isSameSize && encoded.size >= source.size
    ? source
    : encoded;
}

/**
 * JPEG and WebP go through dedicated encoders (MozJPEG / libwebp) instead of the browser's
 * built-in canvas encoder, which exposes no tuning and produces larger files at the same quality.
 * If a codec fails to load or run, the canvas encoder is used so the app keeps working.
 */
async function encodeLossy(
  bitmap: ImageBitmap,
  format: Exclude<OutputFormat, 'png'>,
  quality: number,
  width: number,
  height: number,
  profile: Uint8Array | null,
): Promise<Blob> {
  const surface = rasterize(bitmap, width, height, {
    wide: profile !== null,
    background: format === 'jpeg' ? WHITE : null,
  });
  const encoded = await encodeWithCodec(format, surface, quality).catch(() =>
    surface.canvas.convertToBlob({
      type: FORMAT_META[format].mime,
      quality: quality / 100,
    }),
  );
  return profile && surface.keepProfile
    ? keepDisplayP3(encoded, profile, width, height).catch(() => encoded)
    : encoded;
}

async function encodeWithCodec(
  format: Exclude<OutputFormat, 'png'>,
  surface: Surface,
  quality: number,
) {
  const pixels = surface.context.getImageData(
    0,
    0,
    surface.canvas.width,
    surface.canvas.height,
  );

  if (format === 'jpeg') {
    const codec = await loadJpegEncoder();
    const bytes = await codec.default(pixels, jpegOptions(quality));
    return new Blob([bytes], { type: FORMAT_META.jpeg.mime });
  }

  const codec = await loadWebpEncoder();
  const bytes = await codec.default(pixels, webpOptions(quality));
  return new Blob([bytes], { type: FORMAT_META.webp.mime });
}

/**
 * MozJPEG: progressive scans and optimised Huffman tables are lossless size savings, and trellis
 * quantisation picks cheaper coefficients with little visible change at the same quality value.
 *
 * Chroma is pinned to 4:2:0. MozJPEG's automatic mode switches to 4:2:2 / 4:4:4 at higher
 * qualities, which adds roughly 2x the bytes for only a small colour-fidelity gain.
 */
function jpegOptions(quality: number): JpegEncodeOptions {
  return {
    quality,
    progressive: true,
    optimize_coding: true,
    trellis_opt_zero: true,
    trellis_opt_table: true,
    auto_subsample: false,
    chroma_subsample: 2,
  };
}

/**
 * libwebp: method 6 searches harder for the smallest encoding at the same quality.
 * Sharp YUV is intentionally left off: in testing it increased size noticeably with no PSNR gain.
 */
function webpOptions(quality: number): WebpEncodeOptions {
  return { quality, method: 6 };
}

/**
 * PNG output is either a palette quantisation (lossy, controlled by the quality slider) or, at
 * 100%, a lossless re-encode that never changes pixels.
 */
async function encodePng(
  source: Blob,
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
  optimize: boolean,
) {
  const strategies: Array<() => Promise<Blob>> = [];
  if (quality < 100 && width * height <= PNG_PIXEL_LIMIT) {
    strategies.push(() =>
      quantizedPng(source, bitmap, width, height, quality, optimize),
    );
  }
  strategies.push(() => losslessPng(source, bitmap, width, height, optimize));
  return firstSuccess(strategies);
}

/**
 * Runs strategies in order and returns the first that succeeds. Each failure is logged so a
 * real problem is visible in the console instead of disappearing into a generic error.
 */
async function firstSuccess(
  strategies: Array<() => Promise<Blob>>,
): Promise<Blob> {
  let lastError: unknown = new Error('no png strategy');
  for (const strategy of strategies) {
    try {
      return await strategy();
    } catch (error) {
      console.warn('[encode] png strategy failed:', error);
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Lossless PNG: the source bytes are reused when they are already a same-size PNG (no decode
 * needed); otherwise the pixels are rasterised and written out by the canvas encoder.
 */
async function losslessPng(
  source: Blob,
  bitmap: ImageBitmap,
  width: number,
  height: number,
  optimize: boolean,
) {
  const canUseSource =
    isSameSize(bitmap, width, height) && (await isPng(source));
  const bytes = canUseSource
    ? new Uint8Array(await source.arrayBuffer())
    : await canvasPngBytes(bitmap, width, height);
  return optimisedPng(bytes, optimize);
}

async function canvasPngBytes(
  bitmap: ImageBitmap,
  width: number,
  height: number,
) {
  const { canvas } = rasterize(bitmap, width, height, {
    wide: false,
    background: null,
  });
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

async function quantizedPng(
  source: Blob,
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
  optimize: boolean,
) {
  const wasm = await loadQuantizer();
  const quantizer = new wasm.ImageQuantizer();
  const palette = paletteSettings(quality);
  try {
    quantizer.setMaxColors(palette.maxColors);
    quantizer.setSpeed(4);
    quantizer.setQuality(0, palette.target);
    if (isSameSize(bitmap, width, height) && (await isPng(source))) {
      const result = quantizer.quantizePng(
        new Uint8Array(await source.arrayBuffer()),
        palette.dither,
        'none',
      );
      return await optimisedPng(result.pngBytes, optimize);
    }

    const { context } = rasterize(bitmap, width, height, {
      wide: false,
      background: null,
    });
    const image = context.getImageData(0, 0, width, height);
    const raw = quantizer.quantizeImage(image.data, width, height);
    try {
      raw.setDithering(palette.dither);
      const indices = raw.getPaletteIndices(image.data, width, height);
      return await optimisedPng(
        wasm.encode_palette_to_png(indices, raw.getPalette(), width, height),
        optimize,
      );
    } finally {
      raw.free();
    }
  } finally {
    quantizer.free();
  }
}

/**
 * Losslessly squeezes PNG bytes with oxipng. If the optimiser is unavailable, or `optimize` is
 * false, the input bytes are returned as a valid PNG.
 */
async function optimisedPng(bytes: Uint8Array, optimize: boolean) {
  const input = bytes.slice().buffer;
  if (!optimize) return new Blob([input], { type: FORMAT_META.png.mime });

  const output = await loadOxipng()
    .then((codec) => codec.default(input, { level: OXIPNG_LEVEL }))
    .catch(() => input);
  return new Blob([output], { type: FORMAT_META.png.mime });
}

/**
 * The quality slider sets the libimagequant quality target, which decides how many colours are
 * actually needed. The palette cap is the full 256: a lower cap forced visible banding even when
 * the quality target could have been met with more colours.
 */
function paletteSettings(quality: number) {
  const level = Math.min(100, Math.max(0, Math.round(quality)));
  const dither =
    level >= 85 ? 0.35 : level >= 60 ? 0.2 : level >= 40 ? 0.08 : 0;
  return { maxColors: 256, dither, target: Math.max(level, 1) };
}

/**
 * The wasm-bindgen glue cannot locate its `.wasm` after bundling, so the Vite-emitted URL is
 * passed explicitly. Without it, quantisation fails and PNG output silently loses its best path.
 */
function loadQuantizer() {
  quantizerWasm ??=
    import('libimagequant-wasm/wasm/libimagequant_wasm.js').then(
      async (wasm) => {
        await wasm.default({ module_or_path: quantizerWasmUrl });
        return wasm;
      },
    );
  return quantizerWasm;
}

function rasterize(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  options: { wide: boolean; background: string | null },
): Surface {
  const canvas = new OffscreenCanvas(width, height);
  const surface = drawingSurface(canvas, options.wide);
  if (!surface) throw new Error('context');

  const { context } = surface;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  return surface;
}

function isSameSize(bitmap: ImageBitmap, width: number, height: number) {
  return bitmap.width === width && bitmap.height === height;
}

async function isPng(blob: Blob) {
  const bytes = new Uint8Array(
    await blob.slice(0, PNG_SIGNATURE.length).arrayBuffer(),
  );
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function drawingSurface(
  canvas: OffscreenCanvas,
  wide: boolean,
): Surface | null {
  if (wide) {
    try {
      const context = canvas.getContext('2d', { colorSpace: 'display-p3' });
      if (context)
        return { canvas, context, keepProfile: keepsDisplayP3(context) };
    } catch {
      // Display-P3 canvases are not supported everywhere; fall back to sRGB below.
    }
  }

  const context = canvas.getContext('2d');
  return context ? { canvas, context, keepProfile: false } : null;
}

function keepsDisplayP3(context: OffscreenCanvasRenderingContext2D) {
  const withAttributes = context as OffscreenCanvasRenderingContext2D & {
    getContextAttributes?: () => { colorSpace?: string };
  };
  return withAttributes.getContextAttributes?.().colorSpace === 'display-p3';
}
