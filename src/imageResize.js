// Downscales + compresses an image client-side before upload, so uploaded
// photos stay small regardless of the original file size.
export function resizeImage(file, maxSize = 480, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (blob) resolve(blob)
          else reject(new Error('Could not process that image.'))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = url
  })
}
