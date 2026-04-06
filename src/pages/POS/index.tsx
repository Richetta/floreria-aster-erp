import { POSDesktop } from './POSDesktop';
import { POSMobile } from './POSMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const POS = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null; // Prevents hydration mismatch or loading flash if needed
    }

    return isMobile ? <POSMobile /> : <POSDesktop />;
};
