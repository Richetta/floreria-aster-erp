import RestockDesktop from './RestockDesktop';
import { RestockMobile } from './RestockMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Restock = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }
    
    return isMobile ? <RestockMobile /> : <RestockDesktop />;
};

export default Restock;
