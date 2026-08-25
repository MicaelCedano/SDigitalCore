"use client";

import { useRef, useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";

interface DefectPhotosUploaderProps {
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  existingPhotos?: Array<{ id: string; url: string }>;
  onDeleteExistingPhoto?: (id: string) => Promise<void>;
  isUploading?: boolean;
  maxPhotos?: number;
}

/**
 * Grid de fotos de defectos: subidas existentes + selección nueva (port de
 * SDigitalSystem). El upload real ocurre al guardar la revisión.
 */
export function DefectPhotosUploader({
  selectedFiles,
  onFilesChange,
  existingPhotos = [],
  onDeleteExistingPhoto,
  isUploading = false,
  maxPhotos = 4,
}: DefectPhotosUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const totalPhotos = selectedFiles.length + existingPhotos.length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setNotice(null);

    let filesToAdd: File[] = [];
    let skippedLargeFiles = 0;

    for (const file of newFiles) {
      if (file.size > 10 * 1024 * 1024) {
        skippedLargeFiles++;
        continue;
      }
      filesToAdd.push(file);
    }

    if (skippedLargeFiles > 0) {
      setNotice(`${skippedLargeFiles} archivo(s) excedieron el límite de 10MB y fueron rechazados.`);
    }

    const spaceLeft = maxPhotos - totalPhotos;
    if (filesToAdd.length > spaceLeft) {
      setNotice(`Solo puedes subir hasta ${maxPhotos} fotos. Se truncó la selección.`);
      filesToAdd = filesToAdd.slice(0, spaceLeft);
    }

    if (filesToAdd.length > 0) {
      onFilesChange([...selectedFiles, ...filesToAdd]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (index: number) => {
    const updated = [...selectedFiles];
    updated.splice(index, 1);
    onFilesChange(updated);
  };

  const triggerFileInput = () => {
    if (totalPhotos >= maxPhotos) {
      setNotice(`Límite de ${maxPhotos} fotos alcanzado.`);
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">Fotos de Defectos ({totalPhotos}/{maxPhotos})</span>
        {totalPhotos >= maxPhotos && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Límite alcanzado
          </span>
        )}
      </div>

      {notice && (
        <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        disabled={isUploading}
      />

      <div className="grid grid-cols-4 gap-2">
        {existingPhotos.map((photo) => (
          <div
            key={photo.id}
            className="relative aspect-square rounded-xl border border-slate-200 bg-slate-50 overflow-hidden group shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="Defecto existente" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            {onDeleteExistingPhoto && !isUploading && (
              <button
                type="button"
                onClick={() => onDeleteExistingPhoto(photo.id)}
                className="absolute top-1 right-1 h-5 w-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110"
                title="Eliminar foto"
              >
                <X size={12} strokeWidth={3} />
              </button>
            )}
            <div className="absolute bottom-0 inset-x-0 bg-emerald-600/80 backdrop-blur-xs py-0.5 text-[8px] text-white font-bold text-center">
              Subida
            </div>
          </div>
        ))}

        {selectedFiles.map((file, idx) => {
          const localUrl = URL.createObjectURL(file);
          return (
            <div
              key={`new-${idx}`}
              className="relative aspect-square rounded-xl border border-slate-200 bg-slate-50 overflow-hidden group shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={localUrl}
                alt="Previsualización"
                className="w-full h-full object-cover"
                onLoad={() => URL.revokeObjectURL(localUrl)}
              />
              {!isUploading && (
                <button
                  type="button"
                  onClick={() => removeSelectedFile(idx)}
                  className="absolute top-1 right-1 h-5 w-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110"
                  title="Quitar foto"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-amber-600/80 backdrop-blur-xs py-0.5 text-[8px] text-white font-bold text-center">
                Pendiente
              </div>
            </div>
          );
        })}

        {totalPhotos < maxPhotos && (
          <button
            type="button"
            onClick={triggerFileInput}
            disabled={isUploading}
            className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-[#5750f1] hover:bg-[#5750f1]/5 active:scale-95 transition-all text-slate-400 hover:text-[#5750f1] flex flex-col items-center justify-center gap-1"
          >
            <Camera size={20} className="stroke-[2.5]" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Tomar Foto</span>
          </button>
        )}
      </div>
    </div>
  );
}
