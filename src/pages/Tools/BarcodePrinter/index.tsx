import { BarcodePrinter as BarcodePrinterDesktop } from './BarcodePrinter';
import { BarcodePrinterMobile } from './BarcodePrinterMobile';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

export const BarcodePrinter = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }

    return isMobile ? <BarcodePrinterMobile /> : <BarcodePrinterDesktop />;
};
