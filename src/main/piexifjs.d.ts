declare module 'piexifjs' {
  interface ExifObj {
    '0th': Record<number, string | number | number[]>
    'Exif': Record<number, string | number | number[]>
    'GPS': Record<number, string | number | number[]>
    'Interop': Record<number, string | number | number[]>
    '1st': Record<number, string | number | number[]>
    thumbnail: string | null
  }
  export function load(data: string): ExifObj
  export function dump(exifObj: Partial<ExifObj>): string
  export function insert(exif: string, jpeg: string): string
  export function remove(jpeg: string): string
}
