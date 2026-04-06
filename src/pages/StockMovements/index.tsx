import { StockMovementsDesktop } from './StockMovementsDesktop';
import { StockMovementsMobile } from './StockMovementsMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const StockMovements = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }
    
    return isMobile ? <StockMovementsMobile /> : <StockMovementsDesktop />;
};
