import type { ColorFormat, SourceEvidence } from './schema.js'

export const NOTO_EMOJI_REVISION = 'b960563a023fbd1337227bf2a8a2d5a91889a333'
export const NAN0EMOJI_VERSION = '0.15.0'

const RAW_ROOT = `https://raw.githubusercontent.com/googlefonts/noto-emoji/${NOTO_EMOJI_REVISION}`
export const SOURCE_LICENSE = Object.freeze({
  url: `${RAW_ROOT}/LICENSE`,
  sha256: 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4',
})

const sources = [
  ['svg/emoji_u270d.svg', '2b98d32aa65058b6af142ca9018006682059ff55b5c6d466c56afa0d218f32aa'],
  ['svg/emoji_u270d_1f3fb.svg', 'cd4709ed3492f5520fa6c92a431d65b0d4e1b65b23ecb038208af907cad77691'],
  ['svg/emoji_u270d_1f3fc.svg', '8bd15d61ae4ad570f3e51dc4b348a4400623cb036ee48932c9f29bb2eee708aa'],
  ['svg/emoji_u270d_1f3fd.svg', '18d9f742e65cd73741ca23732622f7a643bfdd53157d87a8fb2c459b3b726be2'],
  ['svg/emoji_u270d_1f3fe.svg', '1380a3a841aa464bf6a1a7ba3b98927ad81df252e17fd76d36ac16f9fc2e9d01'],
  ['svg/emoji_u270d_1f3ff.svg', '37db0e350870dac161ae92e949adcae4b96538012a25ce695103623ead584eea'],
  ['svg/emoji_u1f600.svg', '3ad2cf9b2c32b722b593b0b71e6a2e171a24086da7a94b181532f3431e532e8e'],
  ['svg/emoji_u2764.svg', '280a633e0e72c7f45a0bdbc819d55d3de71dc47439d3024a0b9d3d7c76642023'],
  [
    'svg/emoji_u1f468_200d_1f469_200d_1f467.svg',
    '02e50b72e23c48416da3e533731e83c9576bdf003477e712cc1e8946375df7b1',
  ],
  [
    'svg/emoji_u1f469_200d_1f4bb.svg',
    '24d9f589153a0a2080676aa6b42dc3fd34931cff1afc408f0fa4bc8fc3903622',
  ],
  [
    'third_party/region-flags/waved-svg/emoji_u1f1fa_1f1f8.svg',
    '3ac9c0774556c0ea3da03a48f539ab8a9ae4c822b2254e4dd0e1894e155b1479',
  ],
] as const

export const sourceEvidence: readonly SourceEvidence[] = Object.freeze(
  sources.map(([path, sha256]) => Object.freeze({ path, url: `${RAW_ROOT}/${path}`, sha256 })),
)

export const formatConfiguration: Readonly<Record<ColorFormat, string>> = Object.freeze({
  'colr-v0': 'glyf_colr_0',
  'colr-v1': 'glyf_colr_1',
  sbix: 'sbix',
  svg: 'picosvg',
})

export const acceptedSequences = Object.freeze([
  '✍',
  '✍🏻',
  '✍🏽',
  '✍🏿',
  '😀',
  '❤',
  '👨‍👩‍👧',
  '👩‍💻',
  '🇺🇸',
])
