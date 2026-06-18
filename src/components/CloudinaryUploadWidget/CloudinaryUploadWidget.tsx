import { useEffect, useRef } from 'react';

interface CloudinaryUploadWidgetProps {
  onSuccess: (url: string) => void;
  options?: any;
  children: (open: () => void) => React.ReactNode;
}

export const CloudinaryUploadWidget = ({ onSuccess, options, children }: CloudinaryUploadWidgetProps) => {
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (!('cloudinary' in window)) {
      console.error('Cloudinary script not loaded');
      return;
    }

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      console.warn('Cloudinary environment variables missing');
    }

    const defaultOptions = {
      cloudName,
      uploadPreset,
      sources: ['local', 'url', 'camera'],
      multiple: false,
      maxImageFileSize: 10000000, // 10MB
      language: 'es',
      text: {
        es: {
          menu: {
            files: 'Mis Archivos',
            web: 'Dirección Web',
            camera: 'Cámara'
          },
          local: {
            browse: 'Explorar',
            dd_title_single: 'Arrastrá y soltá una imagen aquí'
          }
        }
      },
      ...options
    };

    widgetRef.current = (window as any).cloudinary.createUploadWidget(
      defaultOptions,
      (error: any, result: any) => {
        if (!error && result && result.event === "success") {
          onSuccess(result.info.secure_url);
        }
      }
    );
  }, [onSuccess, options]);

  const openWidget = () => {
    if (widgetRef.current) {
      widgetRef.current.open();
    }
  };

  return <>{children(openWidget)}</>;
};
