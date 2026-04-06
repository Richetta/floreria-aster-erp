import { WasteDesktop } from './WasteDesktop';
import { WasteMobile } from './WasteMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Waste = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }
    
    return isMobile ? <WasteMobile /> : <WasteDesktop />;
};
