import { DashboardDesktop } from './DashboardDesktop';
import { DashboardMobile } from './DashboardMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Dashboard = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null; // Prevents flash on load
    }

    return isMobile ? <DashboardMobile /> : <DashboardDesktop />;
};
