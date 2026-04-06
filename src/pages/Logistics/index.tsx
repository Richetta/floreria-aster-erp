import { LogisticsDesktop } from './LogisticsDesktop';
import { LogisticsMobile } from './LogisticsMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Logistics = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    if (isMobile === null) return null;
    return isMobile ? <LogisticsMobile /> : <LogisticsDesktop />;
};
