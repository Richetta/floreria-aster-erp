import { RemindersDesktop } from './RemindersDesktop';
import { RemindersMobile } from './RemindersMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Reminders = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    if (isMobile === null) return null;
    return isMobile ? <RemindersMobile /> : <RemindersDesktop />;
};
