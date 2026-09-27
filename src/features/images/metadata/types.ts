/** Metadata an image item carries between nodes. Encoders write it back where they can. */
export interface ImageMetadata {
  /** A TIFF-structured EXIF block, starting with the byte-order mark. */
  exif?: Uint8Array
  /** An XMP packet. */
  xmp?: string
  /** An ICC colour profile. */
  icc?: Uint8Array
}

export type MetadataPart = keyof ImageMetadata

export type StripMode = 'all' | 'location' | 'copyright'

export interface ExifSummary {
  orientation: number
  make: string | null
  model: string | null
  artist: string | null
  copyright: string | null
  dateTaken: string | null
  hasGps: boolean
  location: { latitude: number; longitude: number } | null
}
