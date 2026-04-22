// Invoke the native share sheet ("Open in…") on Safari / iOS / iPadOS, or
// fall back to a download in browsers that don't support file sharing.
export async function sharePdf(url: string, fileName: string): Promise<void> {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    const file = new File([blob], fileName, { type: blob.type || 'application/pdf' })

    const canShareFiles =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })

    if (canShareFiles) {
      await navigator.share({ files: [file], title: fileName })
      return
    }

    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch (e: any) {
    if (e?.name === 'AbortError') return  // user canceled the share sheet
    console.error('Share failed:', e)
    alert(`Share failed: ${e?.message ?? 'unknown error'}`)
  }
}
