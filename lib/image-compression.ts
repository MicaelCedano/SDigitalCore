/**
 * Comprime imágenes en el cliente antes de subirlas (port de SDigitalSystem):
 * escala proporcional a máx. 1280px en el lado largo, convierte a WebP
 * calidad 0.65. Rechaza archivos > 10MB (defensa contra videos).
 */
export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const limitBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > limitBytes) {
      reject(
        new Error(
          `El archivo original supera el límite permitido de 10MB. (Tamaño actual: ${(file.size / (1024 * 1024)).toFixed(2)}MB)`
        )
      );
      return;
    }

    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("La compresión de imagen solo está soportada en el cliente."));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxDimension = 1280;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto del canvas 2D."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Ocurrió un error al intentar generar la imagen comprimida."));
              return;
            }
            resolve(blob);
          },
          "image/webp",
          0.65
        );
      };

      img.onerror = () => {
        reject(new Error("No se pudo cargar la imagen en memoria para procesarla."));
      };
    };

    reader.onerror = () => {
      reject(new Error("Error al leer el archivo de imagen original."));
    };
  });
}
