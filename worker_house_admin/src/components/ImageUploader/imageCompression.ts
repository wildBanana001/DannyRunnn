function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('加载图片失败'));
    image.src = dataUrl;
  });
}

export async function compressImageFile(file: File, maxSide = 1200, quality = 0.8) {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(dataUrl);
    const longestSide = Math.max(image.width, image.height);
    const scale = longestSide > maxSide ? maxSide / longestSide : 1;
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const targetType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, targetType, quality);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    return new File([blob], file.name, {
      lastModified: Date.now(),
      type: targetType,
    });
  } catch {
    return file;
  }
}
