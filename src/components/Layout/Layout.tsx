import { Outlet } from 'react-router-dom';
import { Sidebar } from '../Sidebar/Sidebar';

export const Layout = () => {
    return (
        <div className="app-container">
            <Sidebar />
            <main className="main-content">
                <div className="page-container">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
