import { ReportsDesktop } from './ReportsDesktop';
import { ReportsMobile } from './ReportsMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Reports = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null; // Esperar detección de dispositivo
    }
    
    return isMobile ? <ReportsMobile /> : <ReportsDesktop />;
};
